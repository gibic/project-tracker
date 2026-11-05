import { authorizationServerMetadata, json, preflight, publicOrigin } from '@/features/oauth/http'

export const GET = (request: Request) => json(authorizationServerMetadata(publicOrigin(request)))
export const OPTIONS = preflight
