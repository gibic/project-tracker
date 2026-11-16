import type { Task, TaskStatus } from './task'

/** How much of something is finished, e.g. a project's tasks or a task's checklist. */
export interface Completion {
  total: number
  done: number
  /** 0–100, rounded down so it only shows 100 when everything is done. */
  percent: number
}

export interface Progress extends Completion {
  byStatus: Record<TaskStatus, number>
}

export const emptyStatusCounts = (): Record<TaskStatus, number> => ({ todo: 0, in_progress: 0, done: 0 })

/** Progress from per-status task counts, e.g. from a database aggregate. */
export const progressFromCounts = (counts: Partial<Record<TaskStatus, number>>): Progress => {
  const byStatus = { ...emptyStatusCounts(), ...counts }
  const total = byStatus.todo + byStatus.in_progress + byStatus.done
  const done = byStatus.done
  return { total, done, percent: total === 0 ? 0 : Math.floor((done / total) * 100), byStatus }
}

export const computeProgress = (tasks: Pick<Task, 'status'>[]): Progress => {
  const byStatus = emptyStatusCounts()
  for (const task of tasks) byStatus[task.status] += 1
  return progressFromCounts(byStatus)
}
