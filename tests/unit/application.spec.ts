import { describe, expect, it } from 'vitest'

import { getDashboard } from '@/application/dashboard/getDashboard'
import { createNote, getNote, listTags, updateNote } from '@/application/notes/useCases'
import {
  BOARD_DONE_LIMIT,
  createProject,
  deleteProject,
  getProjectBoard,
  listProjects,
  setProjectArchived,
  updateProject,
} from '@/application/projects/useCases'
import { search } from '@/application/search/useCases'
import {
  addChecklistItem,
  createTask,
  deleteTask,
  moveChecklistItem,
  moveTask,
  removeChecklistItem,
  updateChecklistItem,
  updateTask,
} from '@/application/tasks/useCases'
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

  it('creates the next occurrence when a repeating task is completed', async () => {
    const { ctx, project } = await setup()
    const task = await createTask(ctx, {
      projectId: project.id,
      title: 'Weekly review',
      description: 'Check goals',
      priority: 'high',
      dueDate: '2099-01-05',
      recurrence: 'weekly',
    })

    const done = await moveTask(ctx, { taskId: task.id, status: 'done' })
    expect(done).toMatchObject({ status: 'done', recurrence: null })

    const { tasks } = await getProjectBoard(ctx, project.id)
    const next = tasks.find((t) => t.status === 'todo')
    expect(next).toMatchObject({ title: 'Weekly review', description: 'Check goals', priority: 'high', recurrence: 'weekly' })
    expect(next?.id).not.toBe(task.id)
    expect(next?.dueDate?.toISOString()).toBe('2099-01-12T12:00:00.000Z')
    expect(next?.completedAt).toBeNull()
  })

  it('does not repeat twice when a completed task is reopened and completed again', async () => {
    const { ctx, project } = await setup()
    const task = await createTask(ctx, { projectId: project.id, title: 'Daily', recurrence: 'daily' })
    await updateTask(ctx, task.id, { status: 'done' })
    await moveTask(ctx, { taskId: task.id, status: 'todo' })
    await moveTask(ctx, { taskId: task.id, status: 'done' })
    const { tasks } = await getProjectBoard(ctx, project.id)
    expect(tasks).toHaveLength(2)
  })

  it('does not repeat one-off tasks or moves within done', async () => {
    const { ctx, project } = await setup()
    const once = await createTask(ctx, { projectId: project.id, title: 'Once' })
    await moveTask(ctx, { taskId: once.id, status: 'done' })
    const repeating = await createTask(ctx, { projectId: project.id, title: 'R', recurrence: 'daily' })
    await updateTask(ctx, repeating.id, { recurrence: 'none' })
    await moveTask(ctx, { taskId: repeating.id, status: 'done' })
    const { tasks } = await getProjectBoard(ctx, project.id)
    expect(tasks).toHaveLength(2)
  })

  it('manages an ordered checklist inside a task', async () => {
    const { ctx, project } = await setup()
    const task = await createTask(ctx, { projectId: project.id, title: 'Release', checklist: ['Build', 'Test'] })
    expect(task.checklist.map((i) => [i.text, i.done])).toEqual([
      ['Build', false],
      ['Test', false],
    ])

    const [build, test] = task.checklist
    let updated = await addChecklistItem(ctx, task.id, { text: ' Ship ' })
    const ship = updated.checklist[2]
    expect(ship).toMatchObject({ text: 'Ship', done: false })

    updated = await moveChecklistItem(ctx, task.id, ship.id, { beforeId: build.id, afterId: test.id })
    expect(updated.checklist.map((i) => i.text)).toEqual(['Build', 'Ship', 'Test'])

    updated = await updateChecklistItem(ctx, task.id, build.id, { done: true, text: 'Build it' })
    expect(updated.checklist[0]).toMatchObject({ text: 'Build it', done: true })
    await expect(updateChecklistItem(ctx, task.id, build.id, { done: 'yes' })).rejects.toThrow(ValidationError)

    updated = await removeChecklistItem(ctx, task.id, test.id)
    expect(updated.checklist.map((i) => i.text)).toEqual(['Build it', 'Ship'])

    // Editing the task fields leaves the checklist alone.
    expect((await updateTask(ctx, task.id, { title: 'Release 1.0' })).checklist).toHaveLength(2)
  })

  it('accepts a client-chosen item id only when it is a UUID', async () => {
    const { ctx, project } = await setup()
    const task = await createTask(ctx, { projectId: project.id, title: 'A' })
    const id = crypto.randomUUID()
    expect((await addChecklistItem(ctx, task.id, { id, text: 'x' })).checklist[0].id).toBe(id)
    await expect(addChecklistItem(ctx, task.id, { id, text: 'y' })).rejects.toThrow(/already exists/)
    await expect(addChecklistItem(ctx, task.id, { id: '1', text: 'y' })).rejects.toThrow(/UUID/)
  })

  it('starts the next occurrence with an unchecked copy of the checklist', async () => {
    const { ctx, project } = await setup()
    const task = await createTask(ctx, { projectId: project.id, title: 'Weekly', recurrence: 'weekly', checklist: ['Inbox'] })
    await updateChecklistItem(ctx, task.id, task.checklist[0].id, { done: true })
    await moveTask(ctx, { taskId: task.id, status: 'done' })

    const { tasks } = await getProjectBoard(ctx, project.id)
    const done = tasks.find((t) => t.id === task.id)
    const next = tasks.find((t) => t.status === 'todo')
    expect(done?.checklist[0]).toMatchObject({ text: 'Inbox', done: true })
    expect(next?.checklist[0]).toMatchObject({ text: 'Inbox', done: false })
    expect(next?.checklist[0].id).not.toBe(task.checklist[0].id)
  })

  it('blocks changes in archived projects', async () => {
    const { ctx, project } = await setup()
    const task = await createTask(ctx, { projectId: project.id, title: 'A' })
    await setProjectArchived(ctx, project.id, true)
    await expect(createTask(ctx, { projectId: project.id, title: 'B' })).rejects.toThrow(/archived/)
    await expect(moveTask(ctx, { taskId: task.id, status: 'done' })).rejects.toThrow(/archived/)
    await expect(addChecklistItem(ctx, task.id, { text: 'x' })).rejects.toThrow(/archived/)
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

  it('keeps omitted fields on update', async () => {
    const { ctx, project } = await setup()
    const updated = await updateProject(ctx, project.id, { description: 'Q4 launch' })
    expect(updated).toMatchObject({ name: 'Launch', color: 'sky', description: 'Q4 launch' })
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

  it('keeps omitted fields on update and re-derives link keys from a new body', async () => {
    const { ctx, project } = await setup()
    const note = await createNote(ctx, { title: 'N', body: 'old', tags: ['a'], projectIds: [project.id] })
    const updated = await updateNote(ctx, note.id, { body: 'See [[Other]]' })
    expect(updated).toMatchObject({ title: 'N', tags: ['a'], projectIds: [project.id], linkKeys: ['other'] })
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

describe('done history', () => {
  const setupHistory = async () => {
    const env = await setup()
    const { ctx, clock, project } = env
    await createTask(ctx, { projectId: project.id, title: 'Open' })
    // Completed one minute apart, so "newest" is well defined.
    for (let i = 0; i < BOARD_DONE_LIMIT + 10; i++) {
      clock.current = new Date(clock.current.getTime() + 60_000)
      await createTask(ctx, { projectId: project.id, title: `Done ${i}`, status: 'done' })
    }
    return env
  }

  it('shows only the newest done tasks on the board, and all of them on request', async () => {
    const { ctx, project } = await setupHistory()

    const board = await getProjectBoard(ctx, project.id)
    const done = board.tasks.filter((t) => t.status === 'done')
    expect(done).toHaveLength(BOARD_DONE_LIMIT)
    expect(done.map((t) => t.title)).toContain(`Done ${BOARD_DONE_LIMIT + 9}`)
    expect(done.map((t) => t.title)).not.toContain('Done 0')
    expect(board.tasks.some((t) => t.title === 'Open')).toBe(true)
    expect(board.hiddenDoneCount).toBe(10)

    const all = await getProjectBoard(ctx, project.id, { allDone: true })
    expect(all.tasks.filter((t) => t.status === 'done')).toHaveLength(BOARD_DONE_LIMIT + 10)
    expect(all.hiddenDoneCount).toBe(0)
  })

  it('counts hidden done tasks in progress', async () => {
    const { ctx, project } = await setupHistory()
    const expected = { total: BOARD_DONE_LIMIT + 11, done: BOARD_DONE_LIMIT + 10 }
    expect((await getProjectBoard(ctx, project.id)).project.progress).toMatchObject(expected)
    expect((await listProjects(ctx))[0].progress).toMatchObject(expected)
  })

  it('reports a project without tasks as empty', async () => {
    const { ctx } = await setup()
    expect((await listProjects(ctx))[0].progress).toEqual({
      total: 0,
      done: 0,
      percent: 0,
      byStatus: { todo: 0, in_progress: 0, done: 0 },
    })
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

  it('counts only tasks completed in the last 7 days as done this week', async () => {
    const { ctx, clock, project } = await setup()
    await createTask(ctx, { projectId: project.id, title: 'Old', status: 'done' })
    clock.current = new Date(clock.current.getTime() + 8 * 24 * 60 * 60 * 1000)
    await createTask(ctx, { projectId: project.id, title: 'Recent', status: 'done' })
    await createTask(ctx, { projectId: project.id, title: 'Open', status: 'in_progress' })

    const dashboard = await getDashboard(ctx)
    expect(dashboard.totals).toMatchObject({ openTasks: 1, doneThisWeek: 1 })
    expect(dashboard.inProgress.map((t) => t.title)).toEqual(['Open'])
  })
})

describe('search', () => {
  it('returns projects, tasks with their project, and notes per kind', async () => {
    const { ctx, project } = await setup()
    const task = await createTask(ctx, { projectId: project.id, title: 'Launch checklist', description: 'Print flyers' })
    const note = await createNote(ctx, { title: 'Retro', body: 'The launch went well' })
    await createTask(ctx, { projectId: project.id, title: 'Unrelated' })

    const results = await search(ctx, { query: 'laun' })
    expect(results.projects.map((r) => r.project.id)).toEqual([project.id])
    expect(results.tasks).toEqual([
      { task, project: { id: project.id, name: 'Launch', color: 'sky', status: 'active' }, snippet: 'Print flyers' },
    ])
    expect(results.notes.map((r) => r.note.id)).toEqual([note.id])
    expect(results.notes[0].note).not.toHaveProperty('body')
  })

  it('filters by kind, limits per kind and ignores empty queries', async () => {
    const { ctx, project } = await setup()
    for (const title of ['Launch A', 'Launch B', 'Launch C']) await createTask(ctx, { projectId: project.id, title })

    const tasksOnly = await search(ctx, { query: 'launch', kinds: ['task'], limit: 2 })
    expect(tasksOnly.projects).toEqual([])
    expect(tasksOnly.tasks).toHaveLength(2)
    expect(await search(ctx, { query: '  ?! ' })).toEqual({ projects: [], tasks: [], notes: [] })
    await expect(search(ctx, { query: 'x', limit: 500 })).rejects.toThrow(ValidationError)
  })
})
