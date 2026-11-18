import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AppContext } from '@/application/context'
import type { User } from '@/payload-types'

import { createNote, getNote, listNotes } from '@/application/notes/useCases'
import { createProject, deleteProject, getProjectBoard, listProjects } from '@/application/projects/useCases'
import {
  addChecklistItem,
  createTask,
  moveChecklistItem,
  moveTask,
  updateChecklistItem,
} from '@/application/tasks/useCases'
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

  it('lets a user see and change only their own account', async () => {
    const [aliceUser, bobUser] = users
    const asBob = { user: bobUser, overrideAccess: false } as const

    const { docs } = await payload.find({ collection: 'users', ...asBob })
    expect(docs.map((u) => u.id)).toEqual([bobUser.id])
    await expect(
      payload.update({ collection: 'users', id: aliceUser.id, data: { password: 'taken-over' }, ...asBob }),
    ).rejects.toThrow()
    await expect(payload.delete({ collection: 'users', id: aliceUser.id, ...asBob })).rejects.toThrow()
    await expect(
      payload.create({ collection: 'users', data: { email: `eve-${suffix}@example.test`, password: 'x' }, ...asBob }),
    ).rejects.toThrow()
    await expect(payload.update({ collection: 'users', id: bobUser.id, data: { name: 'Bob' }, ...asBob })).resolves.toMatchObject({ name: 'Bob' })
  })

  it('creates one next occurrence when a repeating task is completed twice at once', async () => {
    const project = await createProject(alice, { name: 'Routines' })
    const task = await createTask(alice, { projectId: project.id, title: 'Daily', recurrence: 'daily' })
    // Bob cannot claim Alice's recurrence through the raw SQL path.
    expect(await bob.tasks.claimRecurrence(task.id)).toBe(false)

    await Promise.all([
      moveTask(alice, { taskId: task.id, status: 'done' }),
      moveTask(alice, { taskId: task.id, status: 'done' }),
    ])
    const { tasks } = await getProjectBoard(alice, project.id)
    expect(tasks.filter((t) => t.status === 'todo').map((t) => t.recurrence)).toEqual(['daily'])
    expect(tasks.find((t) => t.id === task.id)?.recurrence).toBeNull()
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

  it('counts tasks per status in SQL, scoped to the owner', async () => {
    const project = await createProject(alice, { name: 'Counts' })
    const other = await createProject(bob, { name: 'Other' })
    await createTask(alice, { projectId: project.id, title: 'Open' })
    await createTask(alice, { projectId: project.id, title: 'Done 1', status: 'done' })
    await createTask(alice, { projectId: project.id, title: 'Done 2', status: 'done' })
    await createTask(bob, { projectId: other.id, title: 'Not yours', status: 'done' })

    expect(await alice.tasks.countByStatus([project.id, other.id])).toEqual({
      [project.id]: { todo: 1, in_progress: 0, done: 2 },
    })
    expect(await alice.tasks.countCompletedSince([project.id], new Date(Date.now() - 60_000))).toBe(2)
  })

  it('lists task summaries without heavy fields and honours limit and completion order', async () => {
    const project = await createProject(alice, { name: 'Summaries' })
    await createTask(alice, { projectId: project.id, title: 'First', description: 'Long text', checklist: ['A'] })
    const first = await createTask(alice, { projectId: project.id, title: 'Done first', status: 'done' })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const last = await createTask(alice, { projectId: project.id, title: 'Done last', status: 'done' })

    const [summary] = await alice.tasks.listSummaries({ projectId: project.id, excludeStatus: 'done' })
    expect(summary.title).toBe('First')
    expect(summary).not.toHaveProperty('description')
    expect(summary).not.toHaveProperty('checklist')

    const newest = await alice.tasks.list({ projectId: project.id, status: 'done', completedOrder: 'newest', limit: 1 })
    expect(newest.map((t) => t.id)).toEqual([last.id])
    expect(first.id).not.toBe(last.id)
  })

  it('stores an ordered checklist on the task', async () => {
    const project = await createProject(alice, { name: 'Checklist' })
    const task = await createTask(alice, { projectId: project.id, title: 'Release', checklist: ['Build', 'Test'] })
    const [build, test] = task.checklist
    const added = await addChecklistItem(alice, task.id, { text: 'Ship' })
    const ship = added.checklist[2]

    // A fractional position must survive the numeric column, and order must follow it.
    await moveChecklistItem(alice, task.id, ship.id, { beforeId: build.id, afterId: test.id })
    await updateChecklistItem(alice, task.id, build.id, { done: true })

    const { tasks } = await getProjectBoard(alice, project.id)
    const stored = tasks.find((t) => t.id === task.id)!
    expect(stored.checklist.map((i) => [i.id, i.text, i.done])).toEqual([
      [build.id, 'Build', true],
      [ship.id, 'Ship', false],
      [test.id, 'Test', false],
    ])
    expect(stored.checklist[1].position).toBe(1536)
    await expect(addChecklistItem(bob, task.id, { text: 'Hijack' })).rejects.toThrow(NotFoundError)
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

  it('saves fenced code blocks with any language tag', async () => {
    const body = [
      'Intro',
      '',
      '```',
      'plain',
      '```',
      '',
      '```js',
      'const a = 1 * 2 // [[Not a link]]',
      '```',
      '',
      '```bash',
      '# a comment, not a heading',
      'echo "$HOME"',
      '```',
    ].join('\n')
    const note = await createNote(alice, { title: `Code ${suffix}`, body })
    expect((await getNote(alice, note.id)).note.body).toBe(body)
  })
})
