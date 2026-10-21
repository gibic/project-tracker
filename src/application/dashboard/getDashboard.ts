import type { AppContext } from '../context'
import type { ProjectWithProgress } from '../projects/useCases'
import type { NoteSummary } from '@/domain/notes/note'
import type { Task } from '@/domain/tasks/task'

import { compareByUrgency, isDueSoon, isOverdue } from '@/domain/tasks/task'
import { listProjects } from '../projects/useCases'

export interface DashboardTask extends Task {
  projectName: string
}

export interface Dashboard {
  projects: ProjectWithProgress[]
  overdue: DashboardTask[]
  dueSoon: DashboardTask[]
  inProgress: DashboardTask[]
  recentNotes: NoteSummary[]
  totals: { openTasks: number; doneThisWeek: number; notes: number }
}

const DAY_MS = 24 * 60 * 60 * 1000

export const getDashboard = async (ctx: AppContext): Promise<Dashboard> => {
  const now = ctx.clock.now()
  const [projects, notes] = await Promise.all([listProjects(ctx), ctx.notes.list()])
  const tasks = projects.length ? await ctx.tasks.list({ projectIds: projects.map((p) => p.id) }) : []

  const names = new Map(projects.map((p) => [p.id, p.name]))
  const withProject = (task: Task): DashboardTask => ({ ...task, projectName: names.get(task.projectId) ?? '' })

  const weekAgo = new Date(now.getTime() - 7 * DAY_MS)

  return {
    projects,
    overdue: tasks.filter((t) => isOverdue(t, now)).sort(compareByUrgency).map(withProject),
    dueSoon: tasks.filter((t) => isDueSoon(t, now)).sort(compareByUrgency).map(withProject),
    inProgress: tasks
      .filter((t) => t.status === 'in_progress')
      .sort(compareByUrgency)
      .slice(0, 10)
      .map(withProject),
    recentNotes: [...notes].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 6),
    totals: {
      openTasks: tasks.filter((t) => t.status !== 'done').length,
      doneThisWeek: tasks.filter((t) => t.completedAt && t.completedAt >= weekAgo).length,
      notes: notes.length,
    },
  }
}
