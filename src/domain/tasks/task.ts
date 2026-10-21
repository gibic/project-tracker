import type { ID } from '../shared/types'

import { ValidationError } from '../shared/errors'
import { oneOf, optionalText, requireText } from '../shared/validation'

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { low: 0, medium: 1, high: 2, urgent: 3 }

export interface Task {
  id: ID
  projectId: ID
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: Date | null
  /** Sort key inside a status column. Fractional so a move only rewrites one task. */
  position: number
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface TaskInput {
  title: string
  description: string
  priority: TaskPriority
  dueDate: Date | null
}

/**
 * Due dates are calendar days. A bare `YYYY-MM-DD` is pinned to 12:00 UTC so the
 * same day is shown in every timezone from UTC-12 to UTC+12.
 */
const parseDueDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null
  const text = String(value)
  const date =
    value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00.000Z` : text)
  if (Number.isNaN(date.getTime())) throw new ValidationError('dueDate is not a valid date', 'dueDate')
  return date
}

export const validateTaskInput = (input: Partial<Record<keyof TaskInput, unknown>>): TaskInput => ({
  title: requireText(input.title, 'title', { max: 200 }),
  description: optionalText(input.description, 'description', 5000),
  priority: input.priority === undefined ? 'medium' : oneOf(input.priority, TASK_PRIORITIES, 'priority'),
  dueDate: parseDueDate(input.dueDate),
})

export const parseTaskStatus = (value: unknown): TaskStatus => oneOf(value, TASK_STATUSES, 'status')

/** Keeps `completedAt` consistent with the status: set on entering done, cleared on leaving it. */
export const applyStatusChange = (
  task: Pick<Task, 'status' | 'completedAt'>,
  status: TaskStatus,
  now: Date,
): Pick<Task, 'status' | 'completedAt'> => {
  if (status === task.status) return { status, completedAt: task.completedAt }
  return { status, completedAt: status === 'done' ? now : null }
}

const startOfDay = (date: Date): Date => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** A task is overdue when it is open and its due day is before today. */
export const isOverdue = (task: Pick<Task, 'status' | 'dueDate'>, now: Date): boolean =>
  task.status !== 'done' && task.dueDate !== null && task.dueDate < startOfDay(now)

/** Open, not overdue, and due within the next `days` days (today included). */
export const isDueSoon = (task: Pick<Task, 'status' | 'dueDate'>, now: Date, days = 7): boolean => {
  if (task.status === 'done' || task.dueDate === null || isOverdue(task, now)) return false
  const limit = startOfDay(now)
  limit.setDate(limit.getDate() + days + 1)
  return task.dueDate < limit
}

/** Most urgent first: higher priority, then earlier due date, then board order. */
export const compareByUrgency = (a: Task, b: Task): number => {
  const byPriority = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
  if (byPriority !== 0) return byPriority
  const aDue = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY
  const bDue = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY
  if (aDue !== bDue) return aDue - bDue
  return a.position - b.position
}

export const compareByPosition = (a: Pick<Task, 'position'>, b: Pick<Task, 'position'>): number =>
  a.position - b.position

export const POSITION_STEP = 1024

/**
 * Position for a task dropped between two neighbours in a column.
 * `before` is the task that will be above it, `after` the one below; either may be missing.
 */
export const positionBetween = (before?: number | null, after?: number | null): number => {
  const hasBefore = typeof before === 'number'
  const hasAfter = typeof after === 'number'
  if (hasBefore && hasAfter) return (before + after) / 2
  if (hasBefore) return before + POSITION_STEP
  if (hasAfter) return after - POSITION_STEP
  return POSITION_STEP
}
