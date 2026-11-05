import { authenticateAccessToken } from '@/application/oauth/useCases'
import { isAccessToken } from '@/domain/oauth/oauth'
import { getApiKeyUser, getPayloadClient, getUserById } from '@/infrastructure/auth/session'
import { createOAuthContext } from '@/infrastructure/container'

/** Resolves a bearer token to its user: an OAuth access token, or else a Payload user API key. */
export const getBearerUser = async (token: string) => {
  if (!isAccessToken(token)) return getApiKeyUser(token)
  const userId = await authenticateAccessToken(createOAuthContext(await getPayloadClient()), token)
  return userId ? getUserById(userId) : null
}
