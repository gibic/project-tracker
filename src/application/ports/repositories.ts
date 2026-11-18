import type { Note, NoteSummary } from '@/domain/notes/note'
import type { OAuthClient, OAuthGrant } from '@/domain/oauth/oauth'
import type { Project, ProjectColor, ProjectStatus } from '@/domain/projects/project'
import type { SearchKind } from '@/domain/search/search'
import type { ID } from '@/domain/shared/types'
import type { ChecklistItem } from '@/domain/tasks/checklist'
import type { TaskRecurrence } from '@/domain/tasks/recurrence'
import type { Task, TaskPriority, TaskStatus, TaskSummary } from '@/domain/tasks/task'

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
  recurrence: TaskRecurrence | null
  checklist: ChecklistItem[]
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
  /** `newest` sorts by `completedAt` descending instead of board position. */
  completedOrder?: 'newest'
  /** Maximum number of tasks; all matching tasks when omitted. */
  limit?: number
}

export type StatusCounts = Record<TaskStatus, number>

export interface TaskRepository {
  list(filter?: TaskFilter): Promise<Task[]>
  /** Like `list`, without `description` and `checklist`. Use it for lists that can grow without bound. */
  listSummaries(filter?: TaskFilter): Promise<TaskSummary[]>
  /** Task counts per status, keyed by project id. Projects without tasks are absent. */
  countByStatus(projectIds: ID[]): Promise<Record<ID, StatusCounts>>
  /** Number of tasks in these projects completed at or after `since`. */
  countCompletedSince(projectIds: ID[], since: Date): Promise<number>
  findById(id: ID): Promise<Task | null>
  /** Highest position in a project column, or null when the column is empty. */
  maxPosition(projectId: ID, status: TaskStatus): Promise<number | null>
  /** Lowest position in a project column greater than `after`, or null when nothing is below it. */
  nextPosition(projectId: ID, status: TaskStatus, after: number): Promise<number | null>
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
  ids?: ID[]
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

export interface SearchQuery {
  /** Lowercase word terms from `parseSearchTerms`; every term must match a word prefix. */
  terms: string[]
  kinds: SearchKind[]
  /** Maximum hits per kind. */
  limit: number
}

export interface SearchHit {
  kind: SearchKind
  id: ID
  /** Higher is better. Only comparable within one kind. */
  rank: number
  /** Plain-text excerpt of the description or note body around the match; may be empty. */
  snippet: string
}

/**
 * Full-text search over titles, descriptions and note bodies, scoped to the signed-in user.
 * Titles rank above body text. Hits are ordered best first within each kind.
 */
export interface SearchRepository {
  search(query: SearchQuery): Promise<SearchHit[]>
}

export type NewOAuthClient = Omit<OAuthClient, 'id' | 'createdAt'>
export type NewOAuthGrant = Omit<OAuthGrant, 'id'>

/**
 * OAuth persistence. Unlike the ports above it is not user-scoped: the token endpoint
 * runs before any user is known, so implementations act with system privileges.
 */
export interface OAuthRepository {
  createClient(data: NewOAuthClient): Promise<OAuthClient>
  findClient(clientId: string): Promise<OAuthClient | null>
  createGrant(data: NewOAuthGrant): Promise<OAuthGrant>
  findGrant(by: { codeHash: string } | { accessTokenHash: string } | { refreshTokenHash: string }): Promise<OAuthGrant | null>
  updateGrant(id: ID, patch: Partial<NewOAuthGrant>): Promise<OAuthGrant>
  deleteGrant(id: ID): Promise<void>
}
