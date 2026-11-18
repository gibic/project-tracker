import { dayIn } from '../shared/calendar'
import { oneOf } from '../shared/validation'

export const TASK_RECURRENCES = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'] as const
export type TaskRecurrence = (typeof TASK_RECURRENCES)[number]

export const TASK_RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
}

/** Empty values and `'none'` mean the task does not repeat. */
export const parseRecurrence = (value: unknown): TaskRecurrence | null => {
  if (value === null || value === undefined || value === '' || value === 'none') return null
  return oneOf(value, TASK_RECURRENCES, 'recurrence')
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Adds whole months, clamping to the last day of a shorter month (Jan 31 + 1 month = Feb 28). */
const addMonths = (date: Date, months: number): Date => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate()
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay))
  return target
}

/** The `step`-th occurrence after `base`. Computed from `base` each time so month ends do not drift. */
const occurrence = (recurrence: Exclude<TaskRecurrence, 'weekdays'>, base: Date, step: number): Date => {
  switch (recurrence) {
    case 'daily':
      return new Date(base.getTime() + step * DAY_MS)
    case 'weekly':
      return new Date(base.getTime() + step * 7 * DAY_MS)
    case 'monthly':
      return addMonths(base, step)
    case 'yearly':
      return addMonths(base, step * 12)
  }
}

const isWeekend = (date: Date): boolean => date.getUTCDay() === 0 || date.getUTCDay() === 6

/**
 * Due date of the next occurrence when a repeating task is completed.
 * Counts from the current due date (or today when there is none) and skips
 * occurrences that are today or in the past, so a late completion schedules
 * the next one in the future instead of creating an overdue task.
 */
export const nextDueDate = (
  recurrence: TaskRecurrence,
  dueDate: Date | null,
  now: Date,
  timeZone?: string,
): Date => {
  // Today in `timeZone`, pinned to 12:00 UTC like date-only due dates.
  const today = new Date(`${dayIn(now, timeZone)}T12:00:00.000Z`)
  // Stored due dates are pinned to 12:00 UTC, so their calendar day is read in UTC.
  const base = dueDate
    ? new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate(), 12))
    : today

  if (recurrence === 'weekdays') {
    let next = new Date(base.getTime() + DAY_MS)
    while (next <= today || isWeekend(next)) next = new Date(next.getTime() + DAY_MS)
    return next
  }

  for (let step = 1; ; step++) {
    const next = occurrence(recurrence, base, step)
    if (next > today) return next
  }
}
