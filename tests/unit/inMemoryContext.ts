import type { AppContext } from '@/application/context'
import type {
  NoteRepository,
  ProjectRepository,
  TaskRepository,
} from '@/application/ports/repositories'
import type { Note } from '@/domain/notes/note'
import type { Project } from '@/domain/projects/project'
import type { Task } from '@/domain/tasks/task'

import { titleKey } from '@/domain/notes/note'

/** In-memory adapters for the application ports. Same contracts as the Payload ones, no database. */
export const createInMemoryContext = (now = new Date('2026-10-21T09:00:00.000Z')) => {
  let seq = 0
  const nextId = () => String(++seq)
  const clock = { current: now }
  const stamp = () => new Date(clock.current)

  const projects = new Map<string, Project>()
  const tasks = new Map<string, Task>()
  const notes = new Map<string, Note>()

  const projectRepo: ProjectRepository = {
    async list(filter = {}) {
      return [...projects.values()]
        .filter((p) => !filter.status || p.status === filter.status)
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    async findById(id) {
      return projects.get(id) ?? null
    },
    async create(data) {
      const project: Project = { ...data, id: nextId(), status: 'active', createdAt: stamp(), updatedAt: stamp() }
      projects.set(project.id, project)
      return project
    },
    async update(id, patch) {
      const project = { ...projects.get(id)!, ...patch, updatedAt: stamp() }
      projects.set(id, project)
      return project
    },
    async delete(id) {
      projects.delete(id)
    },
  }

  const taskRepo: TaskRepository = {
    async list(filter = {}) {
      return [...tasks.values()]
        .filter(
          (t) =>
            (!filter.projectId || t.projectId === filter.projectId) &&
            (!filter.projectIds || filter.projectIds.includes(t.projectId)) &&
            (!filter.ids || filter.ids.includes(t.id)) &&
            (!filter.status || t.status === filter.status) &&
            (!filter.excludeStatus || t.status !== filter.excludeStatus) &&
            (!filter.dueBefore || (t.dueDate !== null && t.dueDate < filter.dueBefore)),
        )
        .sort((a, b) => a.position - b.position)
    },
    async findById(id) {
      return tasks.get(id) ?? null
    },
    async maxPosition(projectId, status) {
      const positions = [...tasks.values()]
        .filter((t) => t.projectId === projectId && t.status === status)
        .map((t) => t.position)
      return positions.length ? Math.max(...positions) : null
    },
    async create(data) {
      const task: Task = { ...data, id: nextId(), createdAt: stamp(), updatedAt: stamp() }
      tasks.set(task.id, task)
      return task
    },
    async update(id, patch) {
      const task = { ...tasks.get(id)!, ...patch, updatedAt: stamp() }
      tasks.set(id, task)
      return task
    },
    async delete(id) {
      tasks.delete(id)
    },
    async deleteByProject(projectId) {
      for (const task of [...tasks.values()]) if (task.projectId === projectId) tasks.delete(task.id)
    },
  }

  const summary = ({ body: _body, ...rest }: Note) => rest

  const noteRepo: NoteRepository = {
    async list(filter = {}) {
      return [...notes.values()]
        .filter(
          (n) =>
            (!filter.search || n.title.toLowerCase().includes(filter.search.toLowerCase())) &&
            (!filter.tag || n.tags.includes(filter.tag)) &&
            (!filter.projectId || n.projectIds.includes(filter.projectId)) &&
            (!filter.taskIds || n.taskIds.some((id) => filter.taskIds!.includes(id))) &&
            (!filter.linksToKey || n.linkKeys.includes(filter.linksToKey)),
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, filter.limit ?? Infinity)
        .map(summary)
    },
    async findById(id) {
      return notes.get(id) ?? null
    },
    async findByTitleKeys(keys) {
      return [...notes.values()].filter((n) => keys.includes(titleKey(n.title))).map(summary)
    },
    async create(data) {
      const note: Note = { ...data, id: nextId(), createdAt: stamp(), updatedAt: stamp() }
      notes.set(note.id, note)
      return note
    },
    async update(id, patch) {
      const note = { ...notes.get(id)!, ...patch, updatedAt: stamp() }
      notes.set(id, note)
      return note
    },
    async delete(id) {
      notes.delete(id)
    },
    async unlinkProject(projectId) {
      for (const note of notes.values()) note.projectIds = note.projectIds.filter((id) => id !== projectId)
    },
    async unlinkTasks(taskIds) {
      for (const note of notes.values()) note.taskIds = note.taskIds.filter((id) => !taskIds.includes(id))
    },
  }

  const ctx: AppContext = {
    projects: projectRepo,
    tasks: taskRepo,
    notes: noteRepo,
    richText: { toHtml: async (markdown) => `<p>${markdown}</p>` },
    clock: { now: () => new Date(clock.current) },
  }

  return { ctx, clock, store: { projects, tasks, notes } }
}
