import type { Task, TaskStatus } from './task'

export interface Progress {
  total: number
  done: number
  /** 0–100, rounded down so a project only shows 100 when every task is done. */
  percent: number
  byStatus: Record<TaskStatus, number>
}

export const computeProgress = (tasks: Pick<Task, 'status'>[]): Progress => {
  const byStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 }
  for (const task of tasks) byStatus[task.status] += 1
  const total = tasks.length
  const done = byStatus.done
  return { total, done, percent: total === 0 ? 0 : Math.floor((done / total) * 100), byStatus }
}
