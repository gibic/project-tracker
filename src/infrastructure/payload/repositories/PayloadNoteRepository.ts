import type { Where } from 'payload'

import type { NewNote, NoteFilter, NoteRepository } from '@/application/ports/repositories'
import type { Note, NoteSummary } from '@/domain/notes/note'
import type { Note as NoteDoc } from '@/payload-types'

import { lexicalToMarkdown, markdownToLexical, type LexicalState } from '../richText'
import { asUser, fromDbId, isNotFound, toDbId, type RepositoryScope } from './shared'

const summarySelect = {
  title: true,
  tags: true,
  projects: true,
  tasks: true,
  linkKeys: true,
  createdAt: true,
  updatedAt: true,
} as const

const toSummary = (doc: Omit<NoteDoc, 'content'>): NoteSummary => ({
  id: fromDbId(doc.id),
  title: doc.title,
  tags: doc.tags ?? [],
  projectIds: (doc.projects ?? []).map(fromDbId),
  taskIds: (doc.tasks ?? []).map(fromDbId),
  linkKeys: doc.linkKeys ?? [],
  createdAt: new Date(doc.createdAt),
  updatedAt: new Date(doc.updatedAt),
})

const toWhere = (filter: NoteFilter): Where => {
  const and: Where[] = []
  if (filter.search) and.push({ title: { like: filter.search } })
  if (filter.tag) and.push({ tags: { in: [filter.tag] } })
  if (filter.projectId) and.push({ projects: { in: [toDbId(filter.projectId)] } })
  if (filter.taskIds) and.push({ tasks: { in: filter.taskIds.map(toDbId) } })
  if (filter.linksToKey) and.push({ linkKeys: { in: [filter.linksToKey] } })
  return and.length ? { and } : {}
}

export const createPayloadNoteRepository = (scope: RepositoryScope): NoteRepository => {
  const { payload } = scope

  const toNote = async (doc: NoteDoc): Promise<Note> => ({
    ...toSummary(doc),
    body: await lexicalToMarkdown(payload.config, doc.content as LexicalState | null),
  })

  const toData = async (data: Partial<NewNote>) => {
    const { body, projectIds, taskIds, ...rest } = data
    return {
      ...rest,
      ...(body !== undefined && { content: (await markdownToLexical(payload.config, body)) as NoteDoc['content'] }),
      ...(projectIds !== undefined && { projects: projectIds.map(toDbId) }),
      ...(taskIds !== undefined && { tasks: taskIds.map(toDbId) }),
    }
  }

  /** Rewrites a relationship list on every note matching `where`, dropping `ids`. */
  const removeReferences = async (field: 'projects' | 'tasks', ids: number[]) => {
    if (ids.length === 0) return
    const { docs } = await payload.find({
      collection: 'notes',
      where: { [field]: { in: ids } },
      select: { [field]: true },
      pagination: false,
      ...asUser(scope),
    })
    for (const doc of docs) {
      const remaining = ((doc as Pick<NoteDoc, typeof field>)[field] ?? [])
        .map((v) => Number(fromDbId(v)))
        .filter((id) => !ids.includes(id))
      await payload.update({ collection: 'notes', id: doc.id, data: { [field]: remaining }, ...asUser(scope) })
    }
  }

  return {
    async list(filter = {}) {
      if (filter.taskIds?.length === 0) return []
      const { docs } = await payload.find({
        collection: 'notes',
        where: toWhere(filter),
        select: summarySelect,
        sort: '-updatedAt',
        ...(filter.limit ? { limit: filter.limit } : { pagination: false }),
        ...asUser(scope),
      })
      return docs.map((doc) => toSummary(doc as NoteDoc))
    },

    async findById(id) {
      try {
        const doc = await payload.findByID({ collection: 'notes', id: toDbId(id), ...asUser(scope) })
        return doc ? toNote(doc) : null
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },

    async findByTitleKeys(keys) {
      if (keys.length === 0) return []
      const { docs } = await payload.find({
        collection: 'notes',
        where: { titleKey: { in: keys } },
        select: summarySelect,
        pagination: false,
        ...asUser(scope),
      })
      return docs.map((doc) => toSummary(doc as NoteDoc))
    },

    async create(data) {
      const doc = await payload.create({
        collection: 'notes',
        data: { ...(await toData(data)), title: data.title, owner: scope.user.id },
        ...asUser(scope),
      })
      return toNote(doc)
    },

    async update(id, patch) {
      const doc = await payload.update({
        collection: 'notes',
        id: toDbId(id),
        data: await toData(patch),
        ...asUser(scope),
      })
      return toNote(doc)
    },

    async delete(id) {
      await payload.delete({ collection: 'notes', id: toDbId(id), ...asUser(scope) })
    },

    unlinkProject: (projectId) => removeReferences('projects', [toDbId(projectId)]),

    unlinkTasks: (taskIds) => removeReferences('tasks', taskIds.map(toDbId)),
  }
}
