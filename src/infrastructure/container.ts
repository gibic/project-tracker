import type { Payload } from 'payload'

import type { AppContext, OAuthContext } from '@/application/context'
import type { User } from '@/payload-types'

import { systemClock } from '@/application/ports/services'
import { nodeOAuthCrypto } from './oauth/crypto'
import { createPayloadNoteRepository } from './payload/repositories/PayloadNoteRepository'
import { createPayloadOAuthRepository } from './payload/repositories/PayloadOAuthRepository'
import { createPayloadProjectRepository } from './payload/repositories/PayloadProjectRepository'
import { createPayloadTaskRepository } from './payload/repositories/PayloadTaskRepository'
import { createRichTextRenderer } from './payload/richText'

/**
 * Composition root: the only place that wires concrete adapters to application ports.
 * Every repository is scoped to `user`, so use cases never see another user's data.
 */
export const createAppContext = (payload: Payload, user: User): AppContext => {
  const scope = { payload, user }
  return {
    projects: createPayloadProjectRepository(scope),
    tasks: createPayloadTaskRepository(scope),
    notes: createPayloadNoteRepository(scope),
    richText: createRichTextRenderer(payload.config),
    clock: systemClock,
  }
}

/** OAuth use cases run before a user is known, so this context is not user-scoped. */
export const createOAuthContext = (payload: Payload): OAuthContext => ({
  oauth: createPayloadOAuthRepository(payload),
  crypto: nodeOAuthCrypto,
  clock: systemClock,
})
