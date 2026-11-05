'use server'

import { redirect } from 'next/navigation'

import { approveAuthorization, denyAuthorization } from '@/application/oauth/useCases'
import { isOAuthError } from '@/domain/oauth/oauth'
import { getPayloadClient, getSessionUser } from '@/infrastructure/auth/session'
import { createOAuthContext } from '@/infrastructure/container'
import { authorizePath, pickAuthorizeParams } from './params'

/** Consent form submit. Re-validates the request; on success the browser goes back to the client. */
export async function authorizeAction(formData: FormData): Promise<void> {
  const params = pickAuthorizeParams((key) => formData.get(key))
  const user = await getSessionUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(authorizePath(params))}`)

  const ctx = createOAuthContext(await getPayloadClient())
  let target: string
  try {
    target =
      formData.get('decision') === 'allow'
        ? await approveAuthorization(ctx, String(user.id), params)
        : await denyAuthorization(ctx, params)
  } catch (error) {
    // The consent page re-runs validation and shows the error.
    if (isOAuthError(error)) redirect(authorizePath(params))
    throw error
  }
  redirect(target)
}
