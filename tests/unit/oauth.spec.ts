import { describe, expect, it } from 'vitest'

import type { OAuthContext } from '@/application/context'
import type { OAuthRepository } from '@/application/ports/repositories'
import type { OAuthClient, OAuthGrant } from '@/domain/oauth/oauth'

import {
  type ClientCredentials,
  approveAuthorization,
  authenticateAccessToken,
  denyAuthorization,
  exchangeToken,
  registerClient,
  validateAuthorizationRequest,
} from '@/application/oauth/useCases'
import { OAuthError, validateRedirectUri } from '@/domain/oauth/oauth'
import { nodeOAuthCrypto } from '@/infrastructure/oauth/crypto'

const createInMemoryOAuth = () => {
  let seq = 0
  const clients = new Map<string, OAuthClient>()
  const grants = new Map<string, OAuthGrant>()
  const clock = { current: new Date('2026-11-05T09:00:00.000Z') }

  const oauth: OAuthRepository = {
    async createClient(data) {
      const client = { ...data, id: String(++seq), createdAt: new Date(clock.current) }
      clients.set(client.id, client)
      return client
    },
    async findClient(clientId) {
      return [...clients.values()].find((c) => c.clientId === clientId) ?? null
    },
    async createGrant(data) {
      const grant = { ...data, id: String(++seq) }
      grants.set(grant.id, grant)
      return grant
    },
    async findGrant(by) {
      const [field, value] = Object.entries(by)[0] as [keyof OAuthGrant, string]
      return [...grants.values()].find((g) => g[field] === value) ?? null
    },
    async updateGrant(id, patch) {
      const grant = { ...grants.get(id)!, ...patch }
      grants.set(id, grant)
      return grant
    },
    async deleteGrant(id) {
      grants.delete(id)
    },
  }

  const ctx: OAuthContext = { oauth, crypto: nodeOAuthCrypto, clock: { now: () => new Date(clock.current) } }
  const advance = (ms: number) => (clock.current = new Date(clock.current.getTime() + ms))
  return { ctx, grants, advance }
}

const REDIRECT = 'https://claude.ai/api/mcp/auth_callback'
const VERIFIER = 'a'.repeat(43)
const CHALLENGE = nodeOAuthCrypto.pkceChallenge(VERIFIER)

/** Registers a client and runs the consent step; returns the code and everything needed to redeem it. */
const authorize = async (method: 'none' | 'client_secret_post' = 'none') => {
  const env = createInMemoryOAuth()
  const registration = await registerClient(env.ctx, {
    client_name: 'Claude',
    redirect_uris: [REDIRECT],
    token_endpoint_auth_method: method,
  })
  const params = {
    client_id: registration.client_id,
    redirect_uri: REDIRECT,
    response_type: 'code',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    state: 'xyz',
  }
  const redirect = new URL(await approveAuthorization(env.ctx, '42', params))
  const credentials: ClientCredentials = { clientId: registration.client_id, clientSecret: registration.client_secret }
  return { ...env, registration, params, redirect, code: redirect.searchParams.get('code')!, credentials }
}

const redeem = (env: Awaited<ReturnType<typeof authorize>>, overrides: Record<string, string> = {}) =>
  exchangeToken(
    env.ctx,
    { grant_type: 'authorization_code', code: env.code, redirect_uri: REDIRECT, code_verifier: VERIFIER, ...overrides },
    env.credentials,
  )

describe('oauth registration', () => {
  it('issues a secret only to confidential clients', async () => {
    const { ctx } = createInMemoryOAuth()
    const publicClient = await registerClient(ctx, { redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' })
    const confidential = await registerClient(ctx, { redirect_uris: [REDIRECT] })
    expect(publicClient.client_secret).toBeUndefined()
    expect(confidential.client_secret).toMatch(/^pts_/)
    expect(confidential.token_endpoint_auth_method).toBe('client_secret_basic')
  })

  it('accepts https, loopback http and private-use schemes only', () => {
    expect(validateRedirectUri('https://chatgpt.com/connector_platform_oauth_redirect')).toBeTruthy()
    expect(validateRedirectUri('http://localhost:53682/callback')).toBeTruthy()
    expect(validateRedirectUri('cursor://anysphere.cursor-mcp/oauth/callback')).toBeTruthy()
    expect(() => validateRedirectUri('http://evil.example/cb')).toThrow(OAuthError)
    expect(() => validateRedirectUri('javascript:alert(1)')).toThrow(OAuthError)
    expect(() => validateRedirectUri('https://a.example/cb#frag')).toThrow(OAuthError)
  })
})

describe('oauth authorization', () => {
  it('redirects back with a code and the original state', async () => {
    const { redirect } = await authorize()
    expect(redirect.origin + redirect.pathname).toBe(REDIRECT)
    expect(redirect.searchParams.get('code')).toMatch(/^ptk_/)
    expect(redirect.searchParams.get('state')).toBe('xyz')
  })

  it('rejects unregistered redirect URIs and missing PKCE', async () => {
    const { ctx, params } = await authorize()
    await expect(
      validateAuthorizationRequest(ctx, { ...params, redirect_uri: 'https://evil.example/cb' }),
    ).rejects.toThrow(/redirect_uri/)
    await expect(validateAuthorizationRequest(ctx, { ...params, code_challenge_method: 'plain' })).rejects.toThrow(
      /PKCE/,
    )
    await expect(validateAuthorizationRequest(ctx, { ...params, client_id: 'ptc_unknown' })).rejects.toThrow(
      /Unknown client/,
    )
  })

  it('returns access_denied when the user declines', async () => {
    const { ctx, params } = await authorize()
    const url = new URL(await denyAuthorization(ctx, params))
    expect(url.searchParams.get('error')).toBe('access_denied')
    expect(url.searchParams.get('state')).toBe('xyz')
  })
})

describe('oauth tokens', () => {
  it('exchanges a code once, with the right verifier, for a working access token', async () => {
    const env = await authorize()
    await expect(redeem(env, { code_verifier: 'b'.repeat(43) })).rejects.toThrow(/code_verifier/)

    const tokens = await redeem(env)
    expect(tokens).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'mcp' })
    expect(await authenticateAccessToken(env.ctx, tokens.access_token)).toBe('42')

    await expect(redeem(env)).rejects.toMatchObject({ code: 'invalid_grant' })
  })

  it('stores only hashes', async () => {
    const env = await authorize()
    const tokens = await redeem(env)
    const stored = JSON.stringify([...env.grants.values()])
    expect(stored).not.toContain(tokens.access_token)
    expect(stored).not.toContain(tokens.refresh_token)
  })

  it('expires codes and access tokens', async () => {
    const env = await authorize()
    env.advance(11 * 60 * 1000)
    await expect(redeem(env)).rejects.toThrow(/expired/)

    const fresh = await authorize()
    const tokens = await redeem(fresh)
    fresh.advance(61 * 60 * 1000)
    expect(await authenticateAccessToken(fresh.ctx, tokens.access_token)).toBeNull()
  })

  it('rotates refresh tokens', async () => {
    const env = await authorize()
    const first = await redeem(env)
    const refresh = (token: string) =>
      exchangeToken(env.ctx, { grant_type: 'refresh_token', refresh_token: token }, env.credentials)

    const second = await refresh(first.refresh_token)
    expect(await authenticateAccessToken(env.ctx, second.access_token)).toBe('42')
    expect(await authenticateAccessToken(env.ctx, first.access_token)).toBeNull()
    await expect(refresh(first.refresh_token)).rejects.toMatchObject({ code: 'invalid_grant' })
  })

  it('requires the secret of confidential clients and binds codes to their client', async () => {
    const env = await authorize('client_secret_post')
    await expect(redeem({ ...env, credentials: { clientId: env.credentials.clientId } })).rejects.toMatchObject({
      code: 'invalid_client',
    })

    const other = await registerClient(env.ctx, { redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' })
    await expect(redeem({ ...env, credentials: { clientId: other.client_id } })).rejects.toMatchObject({
      code: 'invalid_grant',
    })
    expect((await redeem(env)).access_token).toMatch(/^pta_/)
  })

  it('ignores tokens that are not OAuth access tokens', async () => {
    const { ctx } = createInMemoryOAuth()
    expect(await authenticateAccessToken(ctx, 'some-api-key')).toBeNull()
  })
})
