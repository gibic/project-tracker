import type { Note, NoteSummary } from '@/domain/notes/note'
import type { Project, ProjectColor, ProjectStatus } from '@/domain/projects/project'
import type { ID } from '@/domain/shared/types'
import type { Task, TaskPriority, TaskStatus } from '@/domain/tasks/task'

/*
 * Persistence ports. The application layer depends only on these interfaces;
 * infrastructure provides implementations already scoped to the signed-in user.
 */

export interface NewProject {
  name: string
  description: string
  color: ProjectColor
}

export interface ProjectRepository {
  list(filter?: { status?: ProjectStatus }): Promise<Project[]>
  findById(id: ID): Promise<Project | null>
  create(data: NewProject): Promise<Project>
  update(id: ID, patch: Partial<NewProject & { status: ProjectStatus }>): Promise<Project>
  delete(id: ID): Promise<void>
}

export interface NewTask {
  projectId: ID
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: Date | null
  position: number
  completedAt: Date | null
}

export interface TaskFilter {
  projectId?: ID
  projectIds?: ID[]
  ids?: ID[]
  status?: TaskStatus
  /** Excludes tasks with this status. */
  excludeStatus?: TaskStatus
  /** Only tasks with a due date strictly before this moment. */
  dueBefore?: Date
}

export interface TaskRepository {
  list(filter?: TaskFilter): Promise<Task[]>
  findById(id: ID): Promise<Task | null>
  /** Highest position in a project column, or null when the column is empty. */
  maxPosition(projectId: ID, status: TaskStatus): Promise<number | null>
  create(data: NewTask): Promise<Task>
  update(id: ID, patch: Partial<Omit<NewTask, 'projectId'>>): Promise<Task>
  delete(id: ID): Promise<void>
  deleteByProject(projectId: ID): Promise<void>
}

export interface NewNote {
  title: string
  body: string
  tags: string[]
  projectIds: ID[]
  taskIds: ID[]
  linkKeys: string[]
}

export interface NoteFilter {
  /** Case-insensitive match on the title. */
  search?: string
  tag?: string
  projectId?: ID
  taskIds?: ID[]
  /** Notes whose `[[links]]` contain this title key. */
  linksToKey?: string
  limit?: number
}

export interface NoteRepository {
  list(filter?: NoteFilter): Promise<NoteSummary[]>
  findById(id: ID): Promise<Note | null>
  /** Exact lookup by `titleKey`, used to resolve `[[wiki links]]` and enforce unique titles. */
  findByTitleKeys(keys: string[]): Promise<NoteSummary[]>
  create(data: NewNote): Promise<Note>
  update(id: ID, patch: Partial<NewNote>): Promise<Note>
  delete(id: ID): Promise<void>
  /** Removes a project or task id from every note that references it. */
  unlinkProject(projectId: ID): Promise<void>
  unlinkTasks(taskIds: ID[]): Promise<void>
}
