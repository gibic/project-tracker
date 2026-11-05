import { createMcpHandler } from '@modelcontextprotocol/server'

import { createMcpServer } from '@/features/mcp/server'
import { getBearerUser } from '@/features/oauth/bearer'
import { protectedResourceMetadataUrl, publicOrigin, readBearerToken } from '@/features/oauth/http'
import { getPayloadClient } from '@/infrastructure/auth/session'
import { createAppContext } from '@/infrastructure/container'

/*
 * Streamable HTTP MCP endpoint (stateless). Accepts `Authorization: Bearer <token>` where the
 * token is an OAuth access token (claude.ai, ChatGPT) or a Payload user API key (Claude Code,
 * scripts). Every tool call is scoped to that user.
 */

/** RFC 9728 challenge: points clients at the metadata that starts the OAuth flow. */
const unauthorized = (request: Request, invalidToken: boolean) => {
  const metadata = protectedResourceMetadataUrl(publicOrigin(request))
  const challenge = `Bearer resource_metadata="${metadata}"${invalidToken ? ', error="invalid_token"' : ''}`
  return Response.json(
    { error: invalidToken ? 'invalid_token' : 'unauthorized', error_description: 'Sign in with OAuth or send an API key.' },
    { status: 401, headers: { 'WWW-Authenticate': challenge } },
  )
}

const handle = async (request: Request): Promise<Response> => {
  const token = readBearerToken(request)
  const user = token ? await getBearerUser(token) : null
  if (!user) return unauthorized(request, Boolean(token))

  const ctx = createAppContext(await getPayloadClient(), user)
  const handler = createMcpHandler(() => createMcpServer(ctx), {
    onerror: (error) => console.error('[mcp]', error),
  })
  try {
    return await handler.fetch(request)
  } finally {
    await handler.close()
  }
}

export const GET = handle
export const POST = handle
export const DELETE = handle
