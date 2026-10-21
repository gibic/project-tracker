import { describe, expect, it } from 'vitest'

import { getDashboard } from '@/application/dashboard/getDashboard'
import { createNote, getNote, listTags, updateNote } from '@/application/notes/useCases'
import {
  createProject,
  deleteProject,
  getProjectBoard,
  setProjectArchived,
} from '@/application/projects/useCases'
import { createTask, deleteTask, moveTask, updateTask } from '@/application/tasks/useCases'
import { NotFoundError, ValidationError } from '@/domain/shared/errors'
import { createInMemoryContext } from './inMemoryContext'

const setup = async () => {
  const env = createInMemoryContext()
  const project = await createProject(env.ctx, { name: 'Launch', color: 'sky' })
  return { ...env, project }
}

describe('tasks', () => {
  it('appends new tasks to the bottom of their column', async () => {
    const { ctx, project } = await setup()
    const a = await createTask(ctx, { projectId: project.id, title: 'A' })
    const b = await createTask(ctx, { projectId: project.id, title: 'B' })
    const done = await createTask(ctx, { projectId: project.id, title: 'C', status: 'done' })
    expect(b.position).toBeGreaterThan(a.position)
    expect(done.position).toBe(1024)
    expect(done.completedAt).not.toBeNull()
  })

  it('moves a task between neighbours in another column', async () => {
    const { ctx, project } = await setup()
    const a = await createTask(ctx, { projectId: project.id, title: 'A', status: 'in_progress' })
    const b = await createTask(ctx, { projectId: project.id, title: 'B', status: 'in_progress' })
    const c = await createTask(ctx, { projectId: project.id, title: 'C' })

    await moveTask(ctx, { taskId: c.id, status: 'in_progress', beforeId: a.id, afterId: b.id })
    const { tasks } = await getProjectBoard(ctx, project.id)
    expect(tasks.filter((t) => t.status === 'in_progress').map((t) => t.title)).toEqual(['A', 'C', 'B'])
  })

  it('appends when dropped without neighbours and tracks completion', async () => {
    const { ctx, project } = await setup()
    const a = await createTask(ctx, { projectId: project.id, title: 'A', status: 'done' })
    const b = await createTask(ctx, { projectId: project.id, title: 'B' })
    const moved = await moveTask(ctx, { taskId: b.id, status: 'done' })
    expect(moved.position).toBeGreaterThan(a.position)
    expect(moved.completedAt).toEqual(ctx.clock.now())
  })

  it('rejects neighbours from another column', async () => {
    const { ctx, project } = await setup()
    const a = await createTask(ctx, { projectId: project.id, title: 'A' })
    const b = await createTask(ctx, { projectId: project.id, title: 'B', status: 'done' })
    await expect(moveTask(ctx, { taskId: a.id, status: 'in_progress', beforeId: b.id })).rejects.toThrow(
      ValidationError,
    )
  })

  it('keeps unspecified fields on partial update', async () => {
    const { ctx, project } = await setup()
    const task = await createTask(ctx, { projectId: project.id, title: 'A', priority: 'urgent', dueDate: '2026-11-01' })
    const updated = await updateTask(ctx, task.id, { title: 'A2' })
    expect(updated).toMatchObject({ title: 'A2', priority: 'urgent' })
    expect(updated.dueDate?.toISOString()).toBe('2026-11-01T12:00:00.000Z')
  })

  it('blocks changes in archived projects', async () => {
    const { ctx, project } = await setup()
    const task = await createTask(ctx, { projectId: project.id, title: 'A' })
    await setProjectArchived(ctx, project.id, true)
    await expect(createTask(ctx, { projectId: project.id, title: 'B' })).rejects.toThrow(/archived/)
    await expect(moveTask(ctx, { taskId: task.id, status: 'done' })).rejects.toThrow(/archived/)
  })

  it('unlinks a deleted task from notes', async () => {
    const { ctx, project } = await setup()
    const task = await createTask(ctx, { projectId: project.id, title: 'A' })
    const note = await createNote(ctx, { title: 'N', taskIds: [task.id] })
    await deleteTask(ctx, task.id)
    expect((await getNote(ctx, note.id)).note.taskIds).toEqual([])
  })
})

describe('projects', () => {
  it('deletes tasks but keeps notes, detached', async () => {
    const { ctx, project, store } = await setup()
    const task = await createTask(ctx, { projectId: project.id, title: 'A' })
    const note = await createNote(ctx, { title: 'N', projectIds: [project.id], taskIds: [task.id] })
    await deleteProject(ctx, project.id)
    expect(store.tasks.size).toBe(0)
    expect(store.notes.get(note.id)).toMatchObject({ projectIds: [], taskIds: [] })
    await expect(getProjectBoard(ctx, project.id)).rejects.toThrow(NotFoundError)
  })

  it('groups notes by task on the board', async () => {
    const { ctx, project } = await setup()
    const task = await createTask(ctx, { projectId: project.id, title: 'A' })
    await createNote(ctx, { title: 'Spec', taskIds: [task.id] })
    await createNote(ctx, { title: 'Overview', projectIds: [project.id] })
    const board = await getProjectBoard(ctx, project.id)
    expect(board.notes.map((n) => n.title)).toEqual(['Overview'])
    expect(board.notesByTask[task.id].map((n) => n.title)).toEqual(['Spec'])
  })
})

describe('notes', () => {
  it('enforces unique titles case-insensitively', async () => {
    const { ctx } = createInMemoryContext()
    await createNote(ctx, { title: 'Rust' })
    await expect(createNote(ctx, { title: ' rust ' })).rejects.toThrow(/already titled/)
  })

  it('resolves wiki links and backlinks, including notes created later', async () => {
    const { ctx } = createInMemoryContext()
    const a = await createNote(ctx, { title: 'A', body: 'Links to [[B]] and [[Missing]].' })
    const b = await createNote(ctx, { title: 'B' })

    const detailA = await getNote(ctx, a.id)
    expect(detailA.wikiLinks).toEqual([
      { title: 'B', noteId: b.id },
      { title: 'Missing', noteId: null },
    ])
    expect((await getNote(ctx, b.id)).backlinks.map((n) => n.title)).toEqual(['A'])

    await updateNote(ctx, a.id, { title: 'A', body: 'No links now.' })
    expect((await getNote(ctx, b.id)).backlinks).toEqual([])
  })

  it('drops references to projects and tasks that do not exist for the user', async () => {
    const { ctx, project } = await setup()
    const note = await createNote(ctx, { title: 'N', projectIds: [project.id, '999'], taskIds: ['998'] })
    expect(note).toMatchObject({ projectIds: [project.id], taskIds: [] })
  })

  it('counts tags', async () => {
    const { ctx } = createInMemoryContext()
    await createNote(ctx, { title: '1', tags: 'rust, ideas' })
    await createNote(ctx, { title: '2', tags: 'rust' })
    expect(await listTags(ctx)).toEqual([
      { tag: 'rust', count: 2 },
      { tag: 'ideas', count: 1 },
    ])
  })
})

describe('dashboard', () => {
  it('summarizes overdue, due soon and completed work', async () => {
    const { ctx, project } = await setup()
    await createTask(ctx, { projectId: project.id, title: 'Late', dueDate: '2026-10-19' })
    await createTask(ctx, { projectId: project.id, title: 'Soon', dueDate: '2026-10-23' })
    await createTask(ctx, { projectId: project.id, title: 'Done', status: 'done' })
    await createNote(ctx, { title: 'Note' })

    const dashboard = await getDashboard(ctx)
    expect(dashboard.overdue.map((t) => [t.title, t.projectName])).toEqual([['Late', 'Launch']])
    expect(dashboard.dueSoon.map((t) => t.title)).toEqual(['Soon'])
    expect(dashboard.totals).toEqual({ openTasks: 2, doneThisWeek: 1, notes: 1 })
    expect(dashboard.projects[0].progress.percent).toBe(33)
  })
})
