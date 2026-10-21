import type { AppContext } from '../context'
import type { NoteSummary } from '@/domain/notes/note'
import type { Project, ProjectInput } from '@/domain/projects/project'
import type { ID } from '@/domain/shared/types'
import type { Task } from '@/domain/tasks/task'

import { validateProjectInput } from '@/domain/projects/project'
import { NotFoundError } from '@/domain/shared/errors'
import { computeProgress, type Progress } from '@/domain/tasks/progress'
import { compareByPosition } from '@/domain/tasks/task'

export interface ProjectWithProgress extends Project {
  progress: Progress
}

export const requireProject = async (ctx: AppContext, id: ID): Promise<Project> => {
  const project = await ctx.projects.findById(id)
  if (!project) throw new NotFoundError('Project', id)
  return project
}

export const listProjects = async (
  ctx: AppContext,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<ProjectWithProgress[]> => {
  const projects = await ctx.projects.list(includeArchived ? {} : { status: 'active' })
  if (projects.length === 0) return []
  const tasks = await ctx.tasks.list({ projectIds: projects.map((p) => p.id) })
  return projects.map((project) => ({
    ...project,
    progress: computeProgress(tasks.filter((t) => t.projectId === project.id)),
  }))
}

export const createProject = async (
  ctx: AppContext,
  input: Partial<Record<keyof ProjectInput, unknown>>,
): Promise<Project> => ctx.projects.create(validateProjectInput(input))

export const updateProject = async (
  ctx: AppContext,
  id: ID,
  input: Partial<Record<keyof ProjectInput, unknown>>,
): Promise<Project> => {
  await requireProject(ctx, id)
  return ctx.projects.update(id, validateProjectInput(input))
}

export const setProjectArchived = async (ctx: AppContext, id: ID, archived: boolean): Promise<Project> => {
  await requireProject(ctx, id)
  return ctx.projects.update(id, { status: archived ? 'archived' : 'active' })
}

/** Deletes the project and its tasks, and detaches notes that referenced either. Notes are kept. */
export const deleteProject = async (ctx: AppContext, id: ID): Promise<void> => {
  await requireProject(ctx, id)
  const tasks = await ctx.tasks.list({ projectId: id })
  await ctx.notes.unlinkTasks(tasks.map((t) => t.id))
  await ctx.notes.unlinkProject(id)
  await ctx.tasks.deleteByProject(id)
  await ctx.projects.delete(id)
}

export interface ProjectBoard {
  project: ProjectWithProgress
  tasks: Task[]
  /** Notes attached to the project itself. */
  notes: NoteSummary[]
  /** Notes attached to individual tasks, keyed by task id. */
  notesByTask: Record<ID, NoteSummary[]>
}

export const getProjectBoard = async (ctx: AppContext, id: ID): Promise<ProjectBoard> => {
  const project = await requireProject(ctx, id)
  const tasks = (await ctx.tasks.list({ projectId: id })).sort(compareByPosition)
  const taskIds = tasks.map((t) => t.id)
  const [projectNotes, taskNotes] = await Promise.all([
    ctx.notes.list({ projectId: id }),
    taskIds.length ? ctx.notes.list({ taskIds }) : Promise.resolve([]),
  ])

  const notesByTask: Record<ID, NoteSummary[]> = {}
  for (const note of taskNotes) {
    for (const taskId of note.taskIds) {
      if (!taskIds.includes(taskId)) continue
      ;(notesByTask[taskId] ??= []).push(note)
    }
  }

  return {
    project: { ...project, progress: computeProgress(tasks) },
    tasks,
    notes: projectNotes,
    notesByTask,
  }
}
