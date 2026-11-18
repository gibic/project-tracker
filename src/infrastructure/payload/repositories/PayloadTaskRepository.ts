import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { Where } from 'payload'

import type { NewTask, StatusCounts, TaskFilter, TaskRepository } from '@/application/ports/repositories'
import type { Task, TaskStatus, TaskSummary } from '@/domain/tasks/task'
import type { Task as TaskDoc } from '@/payload-types'

import { sql } from '@payloadcms/db-postgres'
import { sortChecklist } from '@/domain/tasks/checklist'
import { emptyStatusCounts } from '@/domain/tasks/progress'
import { asUser, fromDbId, isNotFound, toDate, toDbId, type RepositoryScope } from './shared'

const toTaskSummary = (doc: Omit<TaskDoc, 'description' | 'checklist'>): TaskSummary => ({
  id: fromDbId(doc.id),
  projectId: fromDbId(doc.project),
  title: doc.title,
  status: doc.status,
  priority: doc.priority,
  dueDate: toDate(doc.dueDate),
  recurrence: doc.recurrence ?? null,
  position: doc.position,
  completedAt: toDate(doc.completedAt),
  createdAt: new Date(doc.createdAt),
  updatedAt: new Date(doc.updatedAt),
})

const toTask = (doc: TaskDoc): Task => ({
  ...toTaskSummary(doc),
  description: doc.description ?? '',
  checklist: sortChecklist(
    (doc.checklist ?? []).map((item, index) => ({
      // Payload always assigns row ids; the fallback only covers malformed rows.
      id: item.id ?? `${doc.id}-${index}`,
      text: item.text,
      done: item.done ?? false,
      position: item.position,
    })),
  ),
})

// The checklist is a separate table; leaving it out of `select` also skips its join.
const summarySelect = { description: false, checklist: false } as const

const isEmptyFilter = (filter: TaskFilter) => filter.ids?.length === 0 || filter.projectIds?.length === 0

/** Board order by default; `completedOrder: 'newest'` lists the latest completions first. */
const findOptions = (filter: TaskFilter) => ({
  where: toWhere(filter),
  sort: filter.completedOrder === 'newest' ? ['-completedAt', 'position'] : 'position',
  // With pagination off, Payload honours `limit` and skips the count query; undefined means all.
  limit: filter.limit,
  pagination: false as const,
})

interface StatusCountRow extends Record<string, unknown> {
  project_id: number
  status: TaskStatus
  count: number
}

const toData = (data: Partial<NewTask>) => {
  const { projectId, dueDate, completedAt, checklist, ...rest } = data
  return {
    ...rest,
    ...(checklist !== undefined && {
      checklist: checklist.map(({ id, text, done, position }) => ({ id, text, done, position })),
    }),
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
      if (isEmptyFilter(filter)) return []
      const { docs } = await payload.find({ collection: 'tasks', ...findOptions(filter), ...asUser(scope) })
      return docs.map(toTask)
    },

    async listSummaries(filter = {}) {
      if (isEmptyFilter(filter)) return []
      const { docs } = await payload.find({
        collection: 'tasks',
        ...findOptions(filter),
        select: summarySelect,
        ...asUser(scope),
      })
      return docs.map((doc) => toTaskSummary(doc as TaskDoc))
    },

    /*
     * Payload has no GROUP BY, and counting through `find` returns one row per task, done history
     * included. Raw SQL skips access control, so it filters on `owner_id` itself (like search).
     */
    async countByStatus(projectIds) {
      const ids = projectIds.map(toDbId).filter((id) => id > 0)
      if (ids.length === 0) return {}
      const db = (payload.db as unknown as PostgresAdapter).drizzle
      const { rows } = await db.execute<StatusCountRow>(sql`
        SELECT project_id, status, count(*)::int AS count
        FROM tasks
        WHERE owner_id = ${scope.user.id}
          AND project_id IN (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})
        GROUP BY project_id, status
      `)
      const counts: Record<string, StatusCounts> = {}
      for (const row of rows) {
        const key = fromDbId(row.project_id)
        ;(counts[key] ??= emptyStatusCounts())[row.status] = Number(row.count)
      }
      return counts
    },

    async countCompletedSince(projectIds, since) {
      if (projectIds.length === 0) return 0
      const { totalDocs } = await payload.count({
        collection: 'tasks',
        where: {
          and: [
            { project: { in: projectIds.map(toDbId) } },
            { completedAt: { greater_than_equal: since.toISOString() } },
          ],
        },
        ...asUser(scope),
      })
      return totalDocs
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

    async nextPosition(projectId, status, after) {
      const { docs } = await payload.find({
        collection: 'tasks',
        where: {
          and: [
            { project: { equals: toDbId(projectId) } },
            { status: { equals: status } },
            { position: { greater_than: after } },
          ],
        },
        select: { position: true },
        sort: 'position',
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

    // Raw SQL because Payload's update-by-where reads then writes, which two requests can both pass.
    // Raw SQL skips access control, so it filters on `owner_id` itself (like `countByStatus`).
    async claimRecurrence(id) {
      const db = (payload.db as unknown as PostgresAdapter).drizzle
      const { rows } = await db.execute(sql`
        UPDATE tasks SET recurrence = NULL, updated_at = now()
        WHERE id = ${toDbId(id)} AND owner_id = ${scope.user.id} AND recurrence IS NOT NULL
        RETURNING id
      `)
      return rows.length > 0
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
