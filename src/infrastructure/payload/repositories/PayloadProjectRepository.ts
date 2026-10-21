import type { Where } from 'payload'

import type { ProjectRepository } from '@/application/ports/repositories'
import type { Project } from '@/domain/projects/project'
import type { Project as ProjectDoc } from '@/payload-types'

import { asUser, fromDbId, isNotFound, toDbId, type RepositoryScope } from './shared'

const toProject = (doc: ProjectDoc): Project => ({
  id: fromDbId(doc.id),
  name: doc.name,
  description: doc.description ?? '',
  color: doc.color,
  status: doc.status,
  createdAt: new Date(doc.createdAt),
  updatedAt: new Date(doc.updatedAt),
})

// The `tasks` join is for the admin panel only; skip it here.
const select = { name: true, description: true, color: true, status: true, createdAt: true, updatedAt: true } as const

export const createPayloadProjectRepository = (scope: RepositoryScope): ProjectRepository => {
  const { payload } = scope

  return {
    async list(filter = {}) {
      const where: Where = filter.status ? { status: { equals: filter.status } } : {}
      const { docs } = await payload.find({
        collection: 'projects',
        where,
        select,
        sort: 'name',
        pagination: false,
        ...asUser(scope),
      })
      return docs.map((doc) => toProject(doc as ProjectDoc))
    },

    async findById(id) {
      try {
        const doc = await payload.findByID({ collection: 'projects', id: toDbId(id), select, ...asUser(scope) })
        return doc ? toProject(doc as ProjectDoc) : null
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },

    async create(data) {
      const doc = await payload.create({
        collection: 'projects',
        data: { ...data, status: 'active', owner: scope.user.id },
        ...asUser(scope),
      })
      return toProject(doc)
    },

    async update(id, patch) {
      const doc = await payload.update({ collection: 'projects', id: toDbId(id), data: patch, ...asUser(scope) })
      return toProject(doc)
    },

    async delete(id) {
      await payload.delete({ collection: 'projects', id: toDbId(id), ...asUser(scope) })
    },
  }
}
