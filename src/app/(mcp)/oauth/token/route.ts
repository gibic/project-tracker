import { exchangeToken } from '@/application/oauth/useCases'
import { json, oauthErrorResponse, preflight, readClientCredentials, readParams } from '@/features/oauth/http'
import { getPayloadClient } from '@/infrastructure/auth/session'
import { createOAuthContext } from '@/infrastructure/container'

export async function POST(request: Request) {
  try {
    const params = await readParams(request)
    const tokens = await exchangeToken(
      createOAuthContext(await getPayloadClient()),
      params,
      readClientCredentials(request, params),
    )
    return json(tokens, 200, { Pragma: 'no-cache' })
  } catch (error) {
    return oauthErrorResponse(error)
  }
}

export const OPTIONS = preflight
