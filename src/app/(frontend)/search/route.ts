import { search } from '@/application/search/useCases'
import { isDomainError } from '@/domain/shared/errors'
import { toPaletteResults } from '@/features/search/paletteResults'
import { getPayloadClient, getSessionUser } from '@/infrastructure/auth/session'
import { createAppContext } from '@/infrastructure/container'

/*
 * JSON search endpoint for the command palette: `GET /search?q=...&kind=note&limit=5`.
 * A route handler rather than a server action so typing never triggers a layout revalidation
 * and stale requests can be aborted. Session cookie auth; agents use the MCP `search` tool.
 */
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const params = new URL(request.url).searchParams
  const kinds = params.getAll('kind')
  try {
    const results = await search(createAppContext(await getPayloadClient(), user), {
      query: params.get('q') ?? '',
      kinds: kinds.length ? kinds : undefined,
      limit: params.get('limit') ?? 5,
    })
    return Response.json(toPaletteResults(results), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (isDomainError(error)) return Response.json({ error: error.message }, { status: 400 })
    throw error
  }
}
