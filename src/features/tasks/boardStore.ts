import { createStore } from 'zustand/vanilla'

import type { ID } from '@/domain/shared/types'

import {
  applyStatusChange,
  compareByPosition,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '@/domain/tasks/task'

export interface BoardFilter {
  query: string
  priority: TaskPriority | 'all'
}

/** Where a dragged card would land: before the card at `index` of the visible column. */
export interface DropTarget {
  status: TaskStatus
  index: number
}

export interface BoardState {
  projectId: ID
  tasks: Task[]
  filter: BoardFilter
  editingTaskId: ID | null
  draggingTaskId: ID | null
  dropTarget: DropTarget | null
  /** Last failed mutation, shown until dismissed. */
  error: string | null
}

export interface BoardActions {
  /** Replaces local tasks with fresh server data after a revalidation. */
  syncFromServer: (tasks: Task[]) => void
  setFilter: (patch: Partial<BoardFilter>) => void
  openTask: (id: ID) => void
  closeTask: () => void
  startDrag: (id: ID) => void
  setDropTarget: (target: DropTarget | null) => void
  endDrag: () => void
  /** Optimistic move; mirrors the server's `moveTask` so the UI does not wait for a round trip. */
  applyMove: (taskId: ID, status: TaskStatus, position: number, now: Date) => void
  upsertTask: (task: Task) => void
  removeTask: (id: ID) => void
  restore: (tasks: Task[]) => void
  setError: (error: string | null) => void
}

export type BoardStore = BoardState & BoardActions

export const createBoardStore = (projectId: ID, tasks: Task[]) =>
  createStore<BoardStore>()((set) => ({
    projectId,
    tasks,
    filter: { query: '', priority: 'all' },
    editingTaskId: null,
    draggingTaskId: null,
    dropTarget: null,
    error: null,

    syncFromServer: (tasks) => set({ tasks }),
    setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
    openTask: (editingTaskId) => set({ editingTaskId }),
    closeTask: () => set({ editingTaskId: null }),
    startDrag: (draggingTaskId) => set({ draggingTaskId }),
    setDropTarget: (dropTarget) => set({ dropTarget }),
    endDrag: () => set({ draggingTaskId: null, dropTarget: null }),

    applyMove: (taskId, status, position, now) =>
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, ...applyStatusChange(t, status, now), position } : t,
        ),
      })),
    upsertTask: (task) =>
      set((s) => ({
        tasks: s.tasks.some((t) => t.id === task.id)
          ? s.tasks.map((t) => (t.id === task.id ? task : t))
          : [...s.tasks, task],
      })),
    removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
    restore: (tasks) => set({ tasks }),
    setError: (error) => set({ error }),
  }))

/** Pure derivation, used with `useMemo` so components get stable arrays. */
export const visibleColumn = (tasks: Task[], filter: BoardFilter, status: TaskStatus): Task[] => {
  const query = filter.query.trim().toLowerCase()
  return tasks
    .filter(
      (t) =>
        t.status === status &&
        (filter.priority === 'all' || t.priority === filter.priority) &&
        (!query || t.title.toLowerCase().includes(query)),
    )
    .sort(compareByPosition)
}
