import { json, preflight, protectedResourceMetadata, publicOrigin } from '@/features/oauth/http'

// Served at both `/.well-known/oauth-protected-resource` and the path-suffixed `.../mcp` form (RFC 9728).
export const GET = (request: Request) => json(protectedResourceMetadata(publicOrigin(request)))
export const OPTIONS = preflight
