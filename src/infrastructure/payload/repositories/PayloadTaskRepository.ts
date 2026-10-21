import type { Where } from 'payload'

import type { NewTask, TaskFilter, TaskRepository } from '@/application/ports/repositories'
import type { Task } from '@/domain/tasks/task'
import type { Task as TaskDoc } from '@/payload-types'

import { asUser, fromDbId, isNotFound, toDate, toDbId, type RepositoryScope } from './shared'

const toTask = (doc: TaskDoc): Task => ({
  id: fromDbId(doc.id),
  projectId: fromDbId(doc.project),
  title: doc.title,
  description: doc.description ?? '',
  status: doc.status,
  priority: doc.priority,
  dueDate: toDate(doc.dueDate),
  position: doc.position,
  completedAt: toDate(doc.completedAt),
  createdAt: new Date(doc.createdAt),
  updatedAt: new Date(doc.updatedAt),
})

const toData = (data: Partial<NewTask>) => {
  const { projectId, dueDate, completedAt, ...rest } = data
  return {
    ...rest,
    ...(projectId !== undefined && { project: toDbId(projectId) }),
    ...(dueDate !== undefined && { dueDate: dueDate?.toISOString() ?? null }),
    ...(completedAt !== undefined && { completedAt: completedAt?.toISOString() ?? null }),
  }
}

const toWhere = (filter: TaskFilter): Where => {
  const and: Where[] = []
  if (filter.projectId) and.push({ project: { equals: toDbId(filter.projectId) } })
  if (filter.projectIds) and.push({ project: { in: filter.projectIds.map(toDbId) } })
  if (filter.ids) and.push({ id: { in: filter.ids.map(toDbId) } })
  if (filter.status) and.push({ status: { equals: filter.status } })
  if (filter.excludeStatus) and.push({ status: { not_equals: filter.excludeStatus } })
  if (filter.dueBefore) and.push({ dueDate: { less_than: filter.dueBefore.toISOString() } })
  return and.length ? { and } : {}
}

export const createPayloadTaskRepository = (scope: RepositoryScope): TaskRepository => {
  const { payload } = scope

  return {
    async list(filter = {}) {
      if (filter.ids?.length === 0 || filter.projectIds?.length === 0) return []
      const { docs } = await payload.find({
        collection: 'tasks',
        where: toWhere(filter),
        sort: 'position',
        pagination: false,
        ...asUser(scope),
      })
      return docs.map(toTask)
    },

    async findById(id) {
      try {
        const doc = await payload.findByID({ collection: 'tasks', id: toDbId(id), ...asUser(scope) })
        return doc ? toTask(doc) : null
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },

    async maxPosition(projectId, status) {
      const { docs } = await payload.find({
        collection: 'tasks',
        where: { and: [{ project: { equals: toDbId(projectId) } }, { status: { equals: status } }] },
        select: { position: true },
        sort: '-position',
        limit: 1,
        ...asUser(scope),
      })
      return docs[0]?.position ?? null
    },

    async create(data) {
      const doc = await payload.create({
        collection: 'tasks',
        data: { ...toData(data), project: toDbId(data.projectId), owner: scope.user.id } as Omit<
          TaskDoc,
          'id' | 'createdAt' | 'updatedAt'
        >,
        ...asUser(scope),
      })
      return toTask(doc)
    },

    async update(id, patch) {
      const doc = await payload.update({ collection: 'tasks', id: toDbId(id), data: toData(patch), ...asUser(scope) })
      return toTask(doc)
    },

    async delete(id) {
      await payload.delete({ collection: 'tasks', id: toDbId(id), ...asUser(scope) })
    },

    async deleteByProject(projectId) {
      await payload.delete({
        collection: 'tasks',
        where: { project: { equals: toDbId(projectId) } },
        ...asUser(scope),
      })
    },
  }
}
