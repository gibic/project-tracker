import type { NoteRepository, ProjectRepository, TaskRepository } from './ports/repositories'
import type { Clock, RichTextRenderer } from './ports/services'

/**
 * Everything a use case may touch. Built per request by the composition root
 * (`src/infrastructure/container.ts`) and by in-memory fakes in tests.
 */
export interface AppContext {
  projects: ProjectRepository
  tasks: TaskRepository
  notes: NoteRepository
  richText: RichTextRenderer
  clock: Clock
}
