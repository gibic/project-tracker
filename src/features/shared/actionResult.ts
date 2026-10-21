import { unstable_rethrow } from 'next/navigation'

import type { AppContext } from '@/application/context'

import { isDomainError, ValidationError } from '@/domain/shared/errors'
import { getAppContext } from './server'

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string }

/**
 * Runs a use case from a server action and converts business-rule failures into a
 * serializable result. Unexpected errors are logged and hidden from the client.
 */
export const runAction = async <T>(execute: (ctx: AppContext) => Promise<T>): Promise<ActionResult<T>> => {
  try {
    return { ok: true, data: await execute(await getAppContext()) }
  } catch (error) {
    unstable_rethrow(error) // let Next.js redirect / notFound through
    if (isDomainError(error)) {
      return { ok: false, error: error.message, field: error instanceof ValidationError ? error.field : undefined }
    }
    console.error(error)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}
