import type { AppContext } from '../context'
import type { ProjectWithProgress } from '../projects/useCases'
import type { NoteSummary } from '@/domain/notes/note'
import type { TaskSummary } from '@/domain/tasks/task'

import { compareByUrgency, isDueSoon, isOverdue } from '@/domain/tasks/task'
import { listProjects } from '../projects/useCases'

export interface DashboardTask extends TaskSummary {
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
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS)

  const [projects, notes] = await Promise.all([listProjects(ctx), ctx.notes.list()])
  const projectIds = projects.map((p) => p.id)
  // Open tasks only: every list below excludes done tasks, and done counts come from aggregates.
  const [open, doneThisWeek] = projectIds.length
    ? await Promise.all([
        ctx.tasks.listSummaries({ projectIds, excludeStatus: 'done' }),
        ctx.tasks.countCompletedSince(projectIds, weekAgo),
      ])
    : [[], 0]

  const names = new Map(projects.map((p) => [p.id, p.name]))
  const withProject = (task: TaskSummary): DashboardTask => ({ ...task, projectName: names.get(task.projectId) ?? '' })

  return {
    projects,
    overdue: open.filter((t) => isOverdue(t, now)).sort(compareByUrgency).map(withProject),
    dueSoon: open.filter((t) => isDueSoon(t, now)).sort(compareByUrgency).map(withProject),
    inProgress: open
      .filter((t) => t.status === 'in_progress')
      .sort(compareByUrgency)
      .slice(0, 10)
      .map(withProject),
    recentNotes: [...notes].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 6),
    totals: {
      openTasks: open.length,
      doneThisWeek,
      notes: notes.length,
    },
  }
}
