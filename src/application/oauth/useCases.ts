import type { OAuthContext } from '../context'
import type { OAuthClient, OAuthGrant } from '@/domain/oauth/oauth'
import type { ID } from '@/domain/shared/types'

import {
  ACCESS_TOKEN_TTL_MS,
  AUTHORIZATION_CODE_TTL_MS,
  isAccessToken,
  isExpired,
  isValidPkceValue,
  OAUTH_SCOPE,
  OAuthError,
  REFRESH_TOKEN_TTL_MS,
  TOKEN_PREFIX,
  validateClientRegistration,
} from '@/domain/oauth/oauth'

/** Query or form parameters as received; anything may be missing. */
export type OAuthParams = Record<string, string | undefined>

// Registration (RFC 7591)

export interface ClientRegistrationResponse {
  client_id: string
  client_secret?: string
  client_id_issued_at: number
  client_secret_expires_at?: number
  client_name: string
  redirect_uris: string[]
  token_endpoint_auth_method: string
  grant_types: string[]
  response_types: string[]
}

export const registerClient = async (ctx: OAuthContext, metadata: unknown): Promise<ClientRegistrationResponse> => {
  const registration = validateClientRegistration(metadata)
  const secret = registration.tokenEndpointAuthMethod === 'none' ? null : ctx.crypto.randomToken(TOKEN_PREFIX.clientSecret)
  const client = await ctx.oauth.createClient({
    ...registration,
    clientId: ctx.crypto.randomToken(TOKEN_PREFIX.clientId),
    secretHash: secret ? ctx.crypto.hash(secret) : null,
  })
  return {
    client_id: client.clientId,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    client_name: client.name,
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  }
}

// Authorization endpoint

export interface AuthorizationRequest {
  client: Pick<OAuthClient, 'id' | 'clientId' | 'name'>
  redirectUri: string
  codeChallenge: string
  state: string | undefined
}

/**
 * Validates an authorization request. Every failure is shown to the user instead of being
 * redirected, so a bad request can never bounce the browser to an unregistered URL.
 */
export const validateAuthorizationRequest = async (
  ctx: OAuthContext,
  params: OAuthParams,
): Promise<AuthorizationRequest> => {
  const client = params.client_id ? await ctx.oauth.findClient(params.client_id) : null
  if (!client) throw new OAuthError('invalid_client', 'Unknown client. Remove and re-add the connector.')

  const redirectUri =
    params.redirect_uri ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined)
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    throw new OAuthError('invalid_request', 'redirect_uri does not match the registered redirect URIs')
  }
  if (params.response_type !== 'code') {
    throw new OAuthError('unsupported_response_type', 'response_type must be "code"')
  }
  if (params.code_challenge_method !== 'S256' || !isValidPkceValue(params.code_challenge)) {
    throw new OAuthError('invalid_request', 'PKCE is required: send code_challenge with code_challenge_method=S256')
  }

  return {
    client: { id: client.id, clientId: client.clientId, name: client.name },
    redirectUri,
    codeChallenge: params.code_challenge,
    state: params.state,
  }
}

const withQuery = (uri: string, query: Record<string, string | undefined>): string => {
  const url = new URL(uri)
  for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, value)
  return url.toString()
}

/** Records the user's consent and returns the client redirect URL carrying the authorization code. */
export const approveAuthorization = async (ctx: OAuthContext, userId: ID, params: OAuthParams): Promise<string> => {
  const request = await validateAuthorizationRequest(ctx, params)
  const code = ctx.crypto.randomToken(TOKEN_PREFIX.code)
  await ctx.oauth.createGrant({
    userId,
    client: request.client.id,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    codeHash: ctx.crypto.hash(code),
    codeExpiresAt: new Date(ctx.clock.now().getTime() + AUTHORIZATION_CODE_TTL_MS),
    accessTokenHash: null,
    accessTokenExpiresAt: null,
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
  })
  return withQuery(request.redirectUri, { code, state: request.state })
}

export const denyAuthorization = async (ctx: OAuthContext, params: OAuthParams): Promise<string> => {
  const request = await validateAuthorizationRequest(ctx, params)
  return withQuery(request.redirectUri, {
    error: 'access_denied',
    error_description: 'The user denied access',
    state: request.state,
  })
}

// Token endpoint

export interface TokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

export interface ClientCredentials {
  clientId: string
  clientSecret?: string
}

const authenticateClient = async (ctx: OAuthContext, credentials: ClientCredentials): Promise<OAuthClient> => {
  const client = credentials.clientId ? await ctx.oauth.findClient(credentials.clientId) : null
  if (!client) throw new OAuthError('invalid_client', 'Unknown client')
  if (client.secretHash) {
    const secret = credentials.clientSecret ?? ''
    if (!ctx.crypto.safeEqual(ctx.crypto.hash(secret), client.secretHash)) {
      throw new OAuthError('invalid_client', 'Client authentication failed')
    }
  }
  return client
}

const issueTokens = async (ctx: OAuthContext, grant: OAuthGrant): Promise<TokenResponse> => {
  const now = ctx.clock.now().getTime()
  const accessToken = ctx.crypto.randomToken(TOKEN_PREFIX.accessToken)
  const refreshToken = ctx.crypto.randomToken(TOKEN_PREFIX.refreshToken)
  await ctx.oauth.updateGrant(grant.id, {
    codeHash: null,
    codeExpiresAt: null,
    accessTokenHash: ctx.crypto.hash(accessToken),
    accessTokenExpiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
    refreshTokenHash: ctx.crypto.hash(refreshToken),
    refreshTokenExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
  })
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_MS / 1000,
    refresh_token: refreshToken,
    scope: OAUTH_SCOPE,
  }
}

const invalidGrant = (message: string) => new OAuthError('invalid_grant', message)

/** Handles `authorization_code` and `refresh_token` grants. Refresh tokens rotate on every use. */
export const exchangeToken = async (
  ctx: OAuthContext,
  params: OAuthParams,
  credentials: ClientCredentials,
): Promise<TokenResponse> => {
  const client = await authenticateClient(ctx, credentials)
  const now = ctx.clock.now()

  if (params.grant_type === 'authorization_code') {
    const grant = params.code ? await ctx.oauth.findGrant({ codeHash: ctx.crypto.hash(params.code) }) : null
    if (!grant || grant.client !== client.id) throw invalidGrant('Authorization code is invalid')
    if (isExpired(grant.codeExpiresAt, now)) {
      await ctx.oauth.deleteGrant(grant.id)
      throw invalidGrant('Authorization code has expired')
    }
    if (params.redirect_uri !== undefined && params.redirect_uri !== grant.redirectUri) {
      throw invalidGrant('redirect_uri does not match the authorization request')
    }
    if (
      !isValidPkceValue(params.code_verifier) ||
      !ctx.crypto.safeEqual(ctx.crypto.pkceChallenge(params.code_verifier), grant.codeChallenge)
    ) {
      throw invalidGrant('code_verifier does not match the code challenge')
    }
    return issueTokens(ctx, grant)
  }

  if (params.grant_type === 'refresh_token') {
    const grant = params.refresh_token
      ? await ctx.oauth.findGrant({ refreshTokenHash: ctx.crypto.hash(params.refresh_token) })
      : null
    if (!grant || grant.client !== client.id) throw invalidGrant('Refresh token is invalid')
    if (isExpired(grant.refreshTokenExpiresAt, now)) {
      await ctx.oauth.deleteGrant(grant.id)
      throw invalidGrant('Refresh token has expired. Reconnect the app.')
    }
    return issueTokens(ctx, grant)
  }

  throw new OAuthError('unsupported_grant_type', 'grant_type must be authorization_code or refresh_token')
}

// Resource server

/** The user an access token acts for, or null when the token is unknown, revoked or expired. */
export const authenticateAccessToken = async (ctx: OAuthContext, token: string): Promise<ID | null> => {
  if (!isAccessToken(token)) return null
  const grant = await ctx.oauth.findGrant({ accessTokenHash: ctx.crypto.hash(token) })
  if (!grant || isExpired(grant.accessTokenExpiresAt, ctx.clock.now())) return null
  return grant.userId
}
