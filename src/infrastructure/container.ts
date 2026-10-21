import type { Payload } from 'payload'

import type { AppContext } from '@/application/context'
import type { User } from '@/payload-types'

import { systemClock } from '@/application/ports/services'
import { createPayloadNoteRepository } from './payload/repositories/PayloadNoteRepository'
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
