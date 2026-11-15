import type { AppContext } from '../context'
import type { SearchHit } from '../ports/repositories'
import type { NoteSummary } from '@/domain/notes/note'
import type { Project } from '@/domain/projects/project'
import type { ID } from '@/domain/shared/types'
import type { Task } from '@/domain/tasks/task'

import { parseSearchKinds, parseSearchLimit, parseSearchTerms, type SearchKind } from '@/domain/search/search'

export interface SearchInput {
  query?: unknown
  /** Defaults to every kind. */
  kinds?: unknown
  /** Maximum results per kind. */
  limit?: unknown
}

export interface ProjectSearchResult {
  project: Project
  snippet: string
}

export interface TaskSearchResult {
  task: Task
  project: Pick<Project, 'id' | 'name' | 'color' | 'status'>
  snippet: string
}

export interface NoteSearchResult {
  note: NoteSummary
  snippet: string
}

/** Results per kind, best match first. Archived projects and their tasks are included. */
export interface SearchResults {
  projects: ProjectSearchResult[]
  tasks: TaskSearchResult[]
  notes: NoteSearchResult[]
}

const empty = (): SearchResults => ({ projects: [], tasks: [], notes: [] })

const idsOf = (hits: SearchHit[], kind: SearchKind): ID[] => hits.filter((h) => h.kind === kind).map((h) => h.id)

/** Keeps hit order and drops hits whose entity the user can no longer load. */
const inHitOrder = <T extends { id: ID }>(ids: ID[], entities: T[]): T[] => {
  const byId = new Map(entities.map((e) => [e.id, e]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

/**
 * Full-text search for the command palette and agents. Every query term must match a word
 * prefix in a title, description or note body. Entities are re-read through the regular
 * repositories, so results carry the same shape (and owner scoping) as every other use case.
 */
export const search = async (ctx: AppContext, input: SearchInput): Promise<SearchResults> => {
  const terms = parseSearchTerms(typeof input.query === 'string' ? input.query : '')
  const kinds = parseSearchKinds(input.kinds)
  const limit = parseSearchLimit(input.limit)
  if (terms.length === 0) return empty()

  const hits = await ctx.search.search({ terms, kinds, limit })
  const snippets = new Map(hits.map((h) => [`${h.kind}:${h.id}`, h.snippet]))
  const snippet = (kind: SearchKind, id: ID) => snippets.get(`${kind}:${id}`) ?? ''

  const projectIds = idsOf(hits, 'project')
  const taskIds = idsOf(hits, 'task')
  const noteIds = idsOf(hits, 'note')

  const [projects, tasks, notes] = await Promise.all([
    projectIds.length || taskIds.length ? ctx.projects.list() : Promise.resolve([]),
    taskIds.length ? ctx.tasks.list({ ids: taskIds }) : Promise.resolve([]),
    noteIds.length ? ctx.notes.list({ ids: noteIds }) : Promise.resolve([]),
  ])
  const projectById = new Map(projects.map((p) => [p.id, p]))

  return {
    projects: inHitOrder(projectIds, projects).map((project) => ({ project, snippet: snippet('project', project.id) })),
    tasks: inHitOrder(taskIds, tasks).flatMap((task) => {
      const project = projectById.get(task.projectId)
      if (!project) return []
      const { id, name, color, status } = project
      return [{ task, project: { id, name, color, status }, snippet: snippet('task', task.id) }]
    }),
    notes: inHitOrder(noteIds, notes).map((note) => ({ note, snippet: snippet('note', note.id) })),
  }
}
