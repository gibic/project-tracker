import { createMcpHandler } from '@modelcontextprotocol/server'

import { createMcpServer } from '@/features/mcp/server'
import { getApiKeyUser, getPayloadClient } from '@/infrastructure/auth/session'
import { createAppContext } from '@/infrastructure/container'

/*
 * Streamable HTTP MCP endpoint (stateless). Clients authenticate with a Payload user
 * API key sent as `Authorization: Bearer <key>`; every tool call is scoped to that user.
 */

const unauthorized = () =>
  Response.json(
    { error: 'Missing or invalid API key. Send Authorization: Bearer <key>.' },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="project-tracker"' } },
  )

const handle = async (request: Request): Promise<Response> => {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')
  const user = match ? await getApiKeyUser(match[1].trim()) : null
  if (!user) return unauthorized()

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
