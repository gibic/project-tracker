import { registerClient } from '@/application/oauth/useCases'
import { json, oauthErrorResponse, preflight } from '@/features/oauth/http'
import { getPayloadClient } from '@/infrastructure/auth/session'
import { createOAuthContext } from '@/infrastructure/container'

/** RFC 7591 dynamic client registration. Open by design: a client can do nothing until a user consents. */
export async function POST(request: Request) {
  try {
    const metadata = await request.json().catch(() => null)
    return json(await registerClient(createOAuthContext(await getPayloadClient()), metadata), 201)
  } catch (error) {
    return oauthErrorResponse(error)
  }
}

export const OPTIONS = preflight
