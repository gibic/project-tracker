import config from '@payload-config'
import { login, logout } from '@payloadcms/next/auth'
import { headers } from 'next/headers'
import { getPayload, type Payload } from 'payload'

import type { User } from '@/payload-types'

export const getPayloadClient = (): Promise<Payload> => getPayload({ config })

/** Reads the Payload auth cookie from the current request. */
export const getSessionUser = async (): Promise<User | null> => {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  return user ?? null
}

/** Verifies credentials and sets the auth cookie. Throws on bad credentials. */
export const signIn = async (email: string, password: string): Promise<void> => {
  await login({ collection: 'users', config, email, password })
}

export const signOut = async (): Promise<void> => {
  await logout({ config })
}

export const hasAnyUser = async (): Promise<boolean> => {
  const payload = await getPayloadClient()
  const { totalDocs } = await payload.count({ collection: 'users' })
  return totalDocs > 0
}
