import type { ID } from '../shared/types'

/*
 * OAuth 2.1 authorization for MCP clients (claude.ai, ChatGPT, ...).
 * Authorization code flow with mandatory PKCE (S256), dynamic client registration,
 * opaque bearer tokens stored only as hashes, and rotating refresh tokens.
 */

export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'invalid_redirect_uri'
  | 'invalid_client_metadata'
  | 'access_denied'

/** An error with an RFC 6749 / RFC 7591 error code, returned to the client as-is. */
export class OAuthError extends Error {
  constructor(
    readonly code: OAuthErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'OAuthError'
  }
}

export const isOAuthError = (error: unknown): error is OAuthError => error instanceof OAuthError

export const OAUTH_SCOPE = 'mcp'
export const AUTHORIZATION_CODE_TTL_MS = 10 * 60 * 1000
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Prefixes make token types recognizable (and distinguish access tokens from Payload API keys). */
export const TOKEN_PREFIX = {
  clientId: 'ptc_',
  clientSecret: 'pts_',
  code: 'ptk_',
  accessToken: 'pta_',
  refreshToken: 'ptr_',
} as const

export const isAccessToken = (token: string): boolean => token.startsWith(TOKEN_PREFIX.accessToken)

export const TOKEN_ENDPOINT_AUTH_METHODS = ['none', 'client_secret_post', 'client_secret_basic'] as const
export type TokenEndpointAuthMethod = (typeof TOKEN_ENDPOINT_AUTH_METHODS)[number]

export interface OAuthClient {
  id: ID
  /** Public identifier handed to the client at registration. */
  clientId: string
  name: string
  redirectUris: string[]
  tokenEndpointAuthMethod: TokenEndpointAuthMethod
  /** Hash of the client secret; null for public clients (`none`). */
  secretHash: string | null
  createdAt: Date
}

/** One user's authorization of one client: the pending code, then the current token pair. */
export interface OAuthGrant {
  id: ID
  userId: ID
  /** `OAuthClient.id`, not the public client id. */
  client: ID
  redirectUri: string
  codeChallenge: string
  codeHash: string | null
  codeExpiresAt: Date | null
  accessTokenHash: string | null
  accessTokenExpiresAt: Date | null
  refreshTokenHash: string | null
  refreshTokenExpiresAt: Date | null
}

export const isExpired = (expiresAt: Date | null, now: Date): boolean =>
  expiresAt === null || expiresAt.getTime() <= now.getTime()

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const FORBIDDEN_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'vbscript:', 'blob:', 'about:'])

/**
 * Accepts https URLs, http only on loopback (RFC 8252 native apps), and private-use
 * schemes such as `cursor://`. Fragments are not allowed (RFC 6749 3.1.2).
 */
export const validateRedirectUri = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : ''
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new OAuthError('invalid_redirect_uri', `redirect_uri is not a valid URL: ${raw || '(empty)'}`)
  }
  if (url.hash) throw new OAuthError('invalid_redirect_uri', 'redirect_uri must not contain a fragment')
  if (FORBIDDEN_SCHEMES.has(url.protocol)) {
    throw new OAuthError('invalid_redirect_uri', `redirect_uri scheme ${url.protocol} is not allowed`)
  }
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new OAuthError('invalid_redirect_uri', 'http redirect_uri is only allowed for localhost')
  }
  return raw
}

export interface ClientRegistration {
  name: string
  redirectUris: string[]
  tokenEndpointAuthMethod: TokenEndpointAuthMethod
}

/** Validates RFC 7591 client metadata. Only the authorization code flow is supported. */
export const validateClientRegistration = (input: unknown): ClientRegistration => {
  const meta = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>

  if (!Array.isArray(meta.redirect_uris) || meta.redirect_uris.length === 0) {
    throw new OAuthError('invalid_redirect_uri', 'redirect_uris must be a non-empty array')
  }
  if (meta.redirect_uris.length > 20) throw new OAuthError('invalid_redirect_uri', 'Too many redirect_uris')
  const redirectUris = [...new Set(meta.redirect_uris.map(validateRedirectUri))]

  const method = meta.token_endpoint_auth_method ?? 'client_secret_basic'
  if (!(TOKEN_ENDPOINT_AUTH_METHODS as readonly unknown[]).includes(method)) {
    throw new OAuthError(
      'invalid_client_metadata',
      `token_endpoint_auth_method must be one of: ${TOKEN_ENDPOINT_AUTH_METHODS.join(', ')}`,
    )
  }

  const grantTypes = meta.grant_types ?? ['authorization_code']
  if (!Array.isArray(grantTypes) || grantTypes.some((g) => g !== 'authorization_code' && g !== 'refresh_token')) {
    throw new OAuthError('invalid_client_metadata', 'Only authorization_code and refresh_token grants are supported')
  }
  const responseTypes = meta.response_types ?? ['code']
  if (!Array.isArray(responseTypes) || responseTypes.some((r) => r !== 'code')) {
    throw new OAuthError('invalid_client_metadata', 'Only the code response type is supported')
  }

  const name = typeof meta.client_name === 'string' && meta.client_name.trim() ? meta.client_name.trim() : ''
  return {
    name: (name || new URL(redirectUris[0]).host || 'MCP client').slice(0, 100),
    redirectUris,
    tokenEndpointAuthMethod: method as TokenEndpointAuthMethod,
  }
}

/** RFC 7636: 43-128 characters from the unreserved set. Applies to verifiers and S256 challenges. */
const PKCE_VALUE = /^[A-Za-z0-9\-._~]{43,128}$/

export const isValidPkceValue = (value: unknown): value is string => typeof value === 'string' && PKCE_VALUE.test(value)
