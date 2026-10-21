import type { Payload } from 'payload'

import type { User } from '@/payload-types'

/** Every repository call runs as the signed-in user with access control enforced. */
export interface RepositoryScope {
  payload: Payload
  user: User
}

export const asUser = ({ user }: RepositoryScope) => ({ user, overrideAccess: false, depth: 0 }) as const

/** Postgres ids are serial integers; the domain treats ids as opaque strings. */
export const toDbId = (id: string): number => {
  const value = Number(id)
  if (!Number.isInteger(value) || value <= 0) return -1 // matches nothing instead of throwing a DB error
  return value
}

export const fromDbId = (value: number | { id: number }): string =>
  String(typeof value === 'object' ? value.id : value)

export const toDate = (value: string | null | undefined): Date | null => (value ? new Date(value) : null)

export const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'status' in error && (error as { status: number }).status === 404
