import type { SearchResults } from '@/application/search/useCases'
import type { ProjectColor, ProjectStatus } from '@/domain/projects/project'
import type { ID } from '@/domain/shared/types'
import type { TaskStatus } from '@/domain/tasks/task'

/** Compact, JSON-safe search results for the command palette (`GET /search`). */
export interface PaletteResults {
  projects: { id: ID; name: string; color: ProjectColor; status: ProjectStatus; snippet: string }[]
  tasks: {
    id: ID
    title: string
    status: TaskStatus
    snippet: string
    project: { id: ID; name: string; color: ProjectColor; archived: boolean }
  }[]
  notes: { id: ID; title: string; tags: string[]; snippet: string }[]
}

export const toPaletteResults = ({ projects, tasks, notes }: SearchResults): PaletteResults => ({
  projects: projects.map(({ project: { id, name, color, status }, snippet }) => ({ id, name, color, status, snippet })),
  tasks: tasks.map(({ task: { id, title, status }, project, snippet }) => ({
    id,
    title,
    status,
    snippet,
    project: { id: project.id, name: project.name, color: project.color, archived: project.status === 'archived' },
  })),
  notes: notes.map(({ note: { id, title, tags }, snippet }) => ({ id, title, tags, snippet })),
})

export const EMPTY_PALETTE_RESULTS: PaletteResults = { projects: [], tasks: [], notes: [] }
