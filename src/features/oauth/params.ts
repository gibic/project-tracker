import type { OAuthParams } from '@/application/oauth/useCases'

/** Authorization request parameters carried from the query string through the consent form. */
export const AUTHORIZE_PARAMS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'code_challenge',
  'code_challenge_method',
  'state',
  'scope',
  'resource',
] as const

export const pickAuthorizeParams = (read: (key: string) => unknown): OAuthParams =>
  Object.fromEntries(
    AUTHORIZE_PARAMS.flatMap((key) => {
      const value = read(key)
      return typeof value === 'string' ? [[key, value]] : []
    }),
  )

export const authorizePath = (params: OAuthParams): string =>
  `/oauth/authorize?${new URLSearchParams(params as Record<string, string>).toString()}`

/** Only same-origin paths may be used as a post-login destination (no open redirects). */
export const safeNextPath = (value: unknown): string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : '/'
