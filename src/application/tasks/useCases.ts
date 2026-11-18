import type { AppContext } from '../context'
import type { ID } from '@/domain/shared/types'
import type { Task, TaskInput, TaskStatus } from '@/domain/tasks/task'

import { assertProjectIsActive } from '@/domain/projects/project'
import { NotFoundError, ValidationError } from '@/domain/shared/errors'
import { definedFields } from '@/domain/shared/validation'
import {
  addChecklistItem as addItem,
  buildChecklist,
  moveChecklistItem as moveItem,
  parseChecklistItemId,
  parseChecklistText,
  parseChecklistTexts,
  removeChecklistItem as removeItem,
  resetChecklist,
  updateChecklistItem as updateItem,
  type ChecklistItem,
} from '@/domain/tasks/checklist'
import { nextDueDate } from '@/domain/tasks/recurrence'
import {
  applyStatusChange,
  parseTaskStatus,
  positionBetween,
  validateTaskInput,
} from '@/domain/tasks/task'
import { requireProject } from '../projects/useCases'

const newIds = (count: number): ID[] => Array.from({ length: count }, () => crypto.randomUUID())

const requireTask = async (ctx: AppContext, id: ID): Promise<Task> => {
  const task = await ctx.tasks.findById(id)
  if (!task) throw new NotFoundError('Task', id)
  return task
}

const requireEditableTask = async (ctx: AppContext, id: ID): Promise<Task> => {
  const task = await requireTask(ctx, id)
  assertProjectIsActive(await requireProject(ctx, task.projectId))
  return task
}

/**
 * Completing a repeating task creates its next occurrence at the bottom of the todo column.
 * The recurrence moves to the new task, so the completed one stays as history and
 * reopening and completing it again does not create a second copy.
 */
const recurIfCompleted = async (ctx: AppContext, previous: TaskStatus, task: Task): Promise<Task> => {
  if (previous === 'done' || task.status !== 'done' || !task.recurrence) return task

  const max = await ctx.tasks.maxPosition(task.projectId, 'todo')
  await ctx.tasks.create({
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    recurrence: task.recurrence,
    checklist: resetChecklist(task.checklist, newIds(task.checklist.length)),
    dueDate: nextDueDate(task.recurrence, task.dueDate, ctx.clock.now()),
    status: 'todo',
    completedAt: null,
    position: positionBetween(max, null),
  })
  return ctx.tasks.update(task.id, { recurrence: null })
}

export type CreateTaskInput = Partial<Record<keyof TaskInput, unknown>> & {
  projectId: ID
  status?: unknown
  /** Checklist item texts, in order. */
  checklist?: unknown
}

/** New tasks go to the bottom of their column. */
export const createTask = async (ctx: AppContext, input: CreateTaskInput): Promise<Task> => {
  const project = await requireProject(ctx, input.projectId)
  assertProjectIsActive(project)

  const fields = validateTaskInput(input)
  const texts = parseChecklistTexts(input.checklist)
  const status = input.status === undefined ? 'todo' : parseTaskStatus(input.status)
  const max = await ctx.tasks.maxPosition(project.id, status)

  const task = await ctx.tasks.create({
    ...fields,
    checklist: buildChecklist(texts, newIds(texts.length)),
    projectId: project.id,
    position: positionBetween(max, null),
    ...applyStatusChange({ status: 'todo', completedAt: null }, status, ctx.clock.now()),
  })
  return recurIfCompleted(ctx, 'todo', task)
}

export const updateTask = async (
  ctx: AppContext,
  id: ID,
  input: Partial<Record<keyof TaskInput, unknown>> & { status?: unknown },
): Promise<Task> => {
  const task = await requireEditableTask(ctx, id)
  const fields = validateTaskInput({ ...task, ...definedFields(input) })

  if (input.status === undefined || input.status === task.status) return ctx.tasks.update(id, fields)

  // Changing status from the edit form behaves like dropping the task at the bottom of the new column.
  const status = parseTaskStatus(input.status)
  const max = await ctx.tasks.maxPosition(task.projectId, status)
  const updated = await ctx.tasks.update(id, {
    ...fields,
    ...applyStatusChange(task, status, ctx.clock.now()),
    position: positionBetween(max, null),
  })
  return recurIfCompleted(ctx, task.status, updated)
}

export interface MoveTaskInput {
  taskId: ID
  status: unknown
  /** Task that ends up directly above the moved task; omit for the top of the column. */
  beforeId?: ID | null
  /** Task that ends up directly below the moved task; omit for the bottom of the column. */
  afterId?: ID | null
}

/** Moves a task within or across status columns, keeping other tasks untouched. */
export const moveTask = async (ctx: AppContext, input: MoveTaskInput): Promise<Task> => {
  const task = await requireEditableTask(ctx, input.taskId)
  const status = parseTaskStatus(input.status)

  const neighbour = async (id: ID | null | undefined): Promise<Task | null> => {
    if (!id) return null
    if (id === task.id) throw new ValidationError('A task cannot be positioned relative to itself')
    const other = await requireTask(ctx, id)
    if (other.projectId !== task.projectId || other.status !== status) {
      throw new ValidationError('Neighbour tasks must be in the target column')
    }
    return other
  }

  const [before, after] = await Promise.all([neighbour(input.beforeId), neighbour(input.afterId)])

  let position: number
  if (before || after) {
    position = positionBetween(before?.position, after?.position)
  } else {
    // No neighbours (empty drop area, list-view checkbox, agents): append to the end of the column.
    // One indexed lookup instead of loading the column, which for `done` holds all history.
    // If the task is already last in this column, the max is its own position; it stays last.
    position = positionBetween(await ctx.tasks.maxPosition(task.projectId, status), null)
  }

  const moved = await ctx.tasks.update(task.id, { ...applyStatusChange(task, status, ctx.clock.now()), position })
  return recurIfCompleted(ctx, task.status, moved)
}

/** Copies a task, checklist included (with fresh item ids), directly below the original in its column. */
export const duplicateTask = async (ctx: AppContext, id: ID): Promise<Task> => {
  const { id: _id, createdAt: _c, updatedAt: _u, ...task } = await requireEditableTask(ctx, id)
  const next = await ctx.tasks.nextPosition(task.projectId, task.status, task.position)
  return ctx.tasks.create({
    ...task,
    checklist: task.checklist.map((item) => ({ ...item, id: crypto.randomUUID() })),
    position: positionBetween(task.position, next),
  })
}

export const setTaskStatus = (ctx: AppContext, taskId: ID, status: TaskStatus): Promise<Task> =>
  moveTask(ctx, { taskId, status })

export const deleteTask = async (ctx: AppContext, id: ID): Promise<void> => {
  await requireEditableTask(ctx, id)
  await ctx.notes.unlinkTasks([id])
  await ctx.tasks.delete(id)
}

// Checklist. Each change rewrites the task's item list; only the touched item's position changes.

const changeChecklist = async (
  ctx: AppContext,
  taskId: ID,
  change: (items: ChecklistItem[]) => ChecklistItem[],
): Promise<Task> => {
  const task = await requireEditableTask(ctx, taskId)
  return ctx.tasks.update(task.id, { checklist: change(task.checklist) })
}

export interface AddChecklistItemInput {
  text: unknown
  /** Optional client-chosen UUID so the UI can add the item optimistically. */
  id?: unknown
}

/** Adds an item to the bottom of the task's checklist. */
export const addChecklistItem = async (ctx: AppContext, taskId: ID, input: AddChecklistItemInput): Promise<Task> => {
  const text = parseChecklistText(input.text)
  const id = input.id === undefined ? crypto.randomUUID() : parseChecklistItemId(input.id)
  return changeChecklist(ctx, taskId, (items) => addItem(items, { id, text }))
}

export const updateChecklistItem = async (
  ctx: AppContext,
  taskId: ID,
  itemId: ID,
  input: { text?: unknown; done?: unknown },
): Promise<Task> => {
  const patch: { text?: string; done?: boolean } = {}
  if (input.text !== undefined) patch.text = parseChecklistText(input.text)
  if (input.done !== undefined) {
    if (typeof input.done !== 'boolean') throw new ValidationError('done must be true or false', 'done')
    patch.done = input.done
  }
  return changeChecklist(ctx, taskId, (items) => updateItem(items, itemId, patch))
}

export interface MoveChecklistItemInput {
  /** Item that ends up directly above the moved item; omit for the top. */
  beforeId?: ID | null
  /** Item that ends up directly below the moved item; omit for the bottom. */
  afterId?: ID | null
}

export const moveChecklistItem = (
  ctx: AppContext,
  taskId: ID,
  itemId: ID,
  input: MoveChecklistItemInput,
): Promise<Task> => changeChecklist(ctx, taskId, (items) => moveItem(items, itemId, input))

export const removeChecklistItem = (ctx: AppContext, taskId: ID, itemId: ID): Promise<Task> =>
  changeChecklist(ctx, taskId, (items) => removeItem(items, itemId))
