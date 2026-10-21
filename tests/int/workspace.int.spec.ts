import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '@/application/context'
import type { User } from '@/payload-types'

import { createNote, getNote, listNotes } from '@/application/notes/useCases'
import { createProject, deleteProject, getProjectBoard, listProjects } from '@/application/projects/useCases'
import { createTask, moveTask } from '@/application/tasks/useCases'
import { NotFoundError } from '@/domain/shared/errors'
import { createAppContext } from '@/infrastructure/container'
import config from '@/payload.config'

/*
 * Runs use cases through the real Payload repositories and Postgres.
 * Point DATABASE_URL at a disposable database: dev mode pushes the schema.
 */

let payload: Payload
const users: User[] = []
let alice: AppContext
let bob: AppContext

const suffix = Date.now()

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  for (const name of ['alice', 'bob']) {
    users.push(
      await payload.create({
        collection: 'users',
        data: { email: `${name}-${suffix}@example.test`, password: 'test-password', name },
      }),
    )
  }
  alice = createAppContext(payload, users[0])
  bob = createAppContext(payload, users[1])
})

afterAll(async () => {
  if (!payload || users.length === 0) return
  const owners = { owner: { in: users.map((u) => u.id) } }
  for (const collection of ['notes', 'tasks', 'projects'] as const) {
    await payload.delete({ collection, where: owners })
  }
  await payload.delete({ collection: 'users', where: { id: { in: users.map((u) => u.id) } } })
})

describe('Payload repositories', () => {
  it('stamps ownership and isolates users', async () => {
    const project = await createProject(alice, { name: 'Private', color: 'violet' })
    const task = await createTask(alice, { projectId: project.id, title: 'Secret task' })

    expect((await listProjects(alice)).map((p) => p.id)).toContain(project.id)
    expect(await listProjects(bob)).toEqual([])
    await expect(getProjectBoard(bob, project.id)).rejects.toThrow(NotFoundError)
    await expect(moveTask(bob, { taskId: task.id, status: 'done' })).rejects.toThrow(NotFoundError)

    const stored = await payload.findByID({ collection: 'tasks', id: Number(task.id), depth: 0 })
    expect(stored.owner).toBe(users[0].id)
  })

  it('orders tasks and records completion', async () => {
    const project = await createProject(alice, { name: 'Board' })
    const a = await createTask(alice, { projectId: project.id, title: 'A' })
    const b = await createTask(alice, { projectId: project.id, title: 'B' })
    const c = await createTask(alice, { projectId: project.id, title: 'C', dueDate: '2026-12-24' })

    await moveTask(alice, { taskId: c.id, status: 'todo', beforeId: a.id, afterId: b.id })
    const moved = await moveTask(alice, { taskId: a.id, status: 'done' })

    const board = await getProjectBoard(alice, project.id)
    expect(board.tasks.filter((t) => t.status === 'todo').map((t) => t.title)).toEqual(['C', 'B'])
    expect(moved.completedAt).toBeInstanceOf(Date)
    expect(board.tasks.find((t) => t.id === c.id)?.dueDate?.toISOString()).toBe('2026-12-24T12:00:00.000Z')
    expect(board.project.progress).toMatchObject({ total: 3, done: 1 })
  })

  it('round-trips markdown through Lexical and resolves links', async () => {
    const project = await createProject(alice, { name: 'Research' })
    const target = await createNote(alice, { title: `Target ${suffix}`, tags: 'Deep Work' })
    const source = await createNote(alice, {
      title: `Source ${suffix}`,
      body: `## Heading\n\n- **bold** item\n- see [[Target ${suffix}]]\n\n<script>alert(1)</script>`,
      tags: ['deep-work', 'reading'],
      projectIds: [project.id],
    })

    const detail = await getNote(alice, source.id)
    expect(detail.note.body).toContain('## Heading')
    expect(detail.note.body).toContain('**bold**')
    expect(detail.html).toContain('<h2')
    expect(detail.html).toContain('<strong>bold</strong>')
    expect(detail.html).not.toContain('<script>')
    expect(detail.wikiLinks).toEqual([{ title: `Target ${suffix}`, noteId: target.id }])
    expect(detail.projects.map((p) => p.id)).toEqual([project.id])

    const targetDetail = await getNote(alice, target.id)
    expect(targetDetail.backlinks.map((n) => n.id)).toEqual([source.id])

    expect((await listNotes(alice, { tag: 'reading' })).map((n) => n.id)).toEqual([source.id])
    expect((await listNotes(alice, { search: `source ${suffix}` })).map((n) => n.id)).toEqual([source.id])
    expect(await listNotes(bob, { tag: 'reading' })).toEqual([])
    await expect(createNote(alice, { title: `target ${suffix}` })).rejects.toThrow(/already titled/)

    await deleteProject(alice, project.id)
    expect((await getNote(alice, source.id)).note.projectIds).toEqual([])
  })
})
