import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

import type { AppContext } from '@/application/context'

import { isDomainError } from '@/domain/shared/errors'
import { getPayloadClient, getSessionUser } from '@/infrastructure/auth/session'
import { createAppContext } from '@/infrastructure/container'

/** Signed-in user for this request, or a redirect to /login. */
export const requireUser = cache(async () => {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
})

/** Use-case context for this request, scoped to the signed-in user. */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const user = await requireUser()
  return createAppContext(await getPayloadClient(), user)
})

/** Runs a read use case for a page, turning a missing entity into a 404. */
export const loadOrNotFound = async <T>(load: (ctx: AppContext) => Promise<T>): Promise<T> => {
  const ctx = await getAppContext()
  try {
    return await load(ctx)
  } catch (error) {
    if (isDomainError(error) && error.code === 'NOT_FOUND') notFound()
    throw error
  }
}
