import type { AppContext } from '../context'
import type { ID } from '@/domain/shared/types'
import type { Task, TaskInput, TaskStatus } from '@/domain/tasks/task'

import { assertProjectIsActive } from '@/domain/projects/project'
import { NotFoundError, ValidationError } from '@/domain/shared/errors'
import {
  applyStatusChange,
  compareByPosition,
  parseTaskStatus,
  positionBetween,
  validateTaskInput,
} from '@/domain/tasks/task'
import { requireProject } from '../projects/useCases'

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

export type CreateTaskInput = Partial<Record<keyof TaskInput, unknown>> & {
  projectId: ID
  status?: unknown
}

/** New tasks go to the bottom of their column. */
export const createTask = async (ctx: AppContext, input: CreateTaskInput): Promise<Task> => {
  const project = await requireProject(ctx, input.projectId)
  assertProjectIsActive(project)

  const fields = validateTaskInput(input)
  const status = input.status === undefined ? 'todo' : parseTaskStatus(input.status)
  const max = await ctx.tasks.maxPosition(project.id, status)

  return ctx.tasks.create({
    ...fields,
    projectId: project.id,
    position: positionBetween(max, null),
    ...applyStatusChange({ status: 'todo', completedAt: null }, status, ctx.clock.now()),
  })
}

export const updateTask = async (
  ctx: AppContext,
  id: ID,
  input: Partial<Record<keyof TaskInput, unknown>> & { status?: unknown },
): Promise<Task> => {
  const task = await requireEditableTask(ctx, id)
  const provided = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
  const fields = validateTaskInput({ ...task, ...provided })

  if (input.status === undefined || input.status === task.status) return ctx.tasks.update(id, fields)

  // Changing status from the edit form behaves like dropping the task at the bottom of the new column.
  const status = parseTaskStatus(input.status)
  const max = await ctx.tasks.maxPosition(task.projectId, status)
  return ctx.tasks.update(id, {
    ...fields,
    ...applyStatusChange(task, status, ctx.clock.now()),
    position: positionBetween(max, null),
  })
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
    // Dropped on an empty area: append to the end of the column.
    const column = (await ctx.tasks.list({ projectId: task.projectId, status }))
      .filter((t) => t.id !== task.id)
      .sort(compareByPosition)
    position = positionBetween(column.at(-1)?.position, null)
  }

  return ctx.tasks.update(task.id, { ...applyStatusChange(task, status, ctx.clock.now()), position })
}

export const setTaskStatus = (ctx: AppContext, taskId: ID, status: TaskStatus): Promise<Task> =>
  moveTask(ctx, { taskId, status })

export const deleteTask = async (ctx: AppContext, id: ID): Promise<void> => {
  await requireEditableTask(ctx, id)
  await ctx.notes.unlinkTasks([id])
  await ctx.tasks.delete(id)
}
