import type { ClientCredentials, OAuthParams } from '@/application/oauth/useCases'

import { isOAuthError, OAUTH_SCOPE, TOKEN_ENDPOINT_AUTH_METHODS } from '@/domain/oauth/oauth'

/*
 * HTTP plumbing shared by the OAuth and MCP route handlers. The issuer and resource URLs
 * come from the request origin, so metadata matches whatever host the client used.
 */

export const publicOrigin = (request: Request): string => new URL(request.url).origin

export const mcpResourceUrl = (origin: string) => `${origin}/mcp`
export const protectedResourceMetadataUrl = (origin: string) => `${origin}/.well-known/oauth-protected-resource/mcp`

/** No cookies are involved, so any origin may call the discovery, registration and token endpoints. */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version',
}

export const preflight = () => new Response(null, { status: 204, headers: CORS_HEADERS })

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store', ...headers } })

/** RFC 8414 authorization server metadata. */
export const authorizationServerMetadata = (origin: string) => ({
  issuer: origin,
  authorization_endpoint: `${origin}/oauth/authorize`,
  token_endpoint: `${origin}/oauth/token`,
  registration_endpoint: `${origin}/oauth/register`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: [...TOKEN_ENDPOINT_AUTH_METHODS],
  scopes_supported: [OAUTH_SCOPE],
})

/** RFC 9728 protected resource metadata for the MCP endpoint. */
export const protectedResourceMetadata = (origin: string) => ({
  resource: mcpResourceUrl(origin),
  resource_name: 'Project tracker',
  authorization_servers: [origin],
  scopes_supported: [OAUTH_SCOPE],
  bearer_methods_supported: ['header'],
})

/** Turns OAuth errors into RFC 6749 error responses; anything else is a logged server_error. */
export const oauthErrorResponse = (error: unknown): Response => {
  if (isOAuthError(error)) {
    return json({ error: error.code, error_description: error.message }, error.code === 'invalid_client' ? 401 : 400)
  }
  console.error('[oauth]', error)
  return json({ error: 'server_error', error_description: 'Unexpected server error' }, 500)
}

/** Reads a form-encoded (standard) or JSON request body as flat string parameters. */
export const readParams = async (request: Request): Promise<OAuthParams> => {
  const type = request.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(body ?? {}).filter(([, v]) => typeof v === 'string') as [string, string][],
    )
  }
  return Object.fromEntries(new URLSearchParams(await request.text()))
}

/** Client credentials from HTTP Basic (RFC 6749 2.3.1, form-encoded parts) or the request body. */
export const readClientCredentials = (request: Request, params: OAuthParams): ClientCredentials => {
  const match = /^Basic\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')
  if (match) {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8')
    const separator = decoded.indexOf(':')
    const part = (value: string) => decodeURIComponent(value.replace(/\+/g, ' '))
    if (separator > 0) {
      return { clientId: part(decoded.slice(0, separator)), clientSecret: part(decoded.slice(separator + 1)) }
    }
  }
  return { clientId: params.client_id ?? '', clientSecret: params.client_secret }
}

export const readBearerToken = (request: Request): string | null =>
  /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1].trim() || null
