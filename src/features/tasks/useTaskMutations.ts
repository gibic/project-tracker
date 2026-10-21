'use client'

import { useTransition } from 'react'

import type { ID } from '@/domain/shared/types'
import type { TaskInput, TaskStatus } from '@/domain/tasks/task'

import { compareByPosition, positionBetween } from '@/domain/tasks/task'
import { createTaskAction, deleteTaskAction, moveTaskAction, updateTaskAction } from './actions'
import { useBoardStoreApi } from './BoardStoreProvider'

type TaskForm = Partial<Record<keyof TaskInput, unknown>> & { status?: unknown }

/**
 * Bridges board UI and server actions: optimistic store update first,
 * server call second, rollback on failure. Server revalidation then syncs the store.
 */
export function useTaskMutations() {
  const store = useBoardStoreApi()
  const [pending, startTransition] = useTransition()

  const fail = (error: string) => store.getState().setError(error)

  /** `beforeId`/`afterId` are the visible neighbours above/below the drop point. */
  const move = (taskId: ID, status: TaskStatus, beforeId: ID | null, afterId: ID | null) => {
    const { tasks, applyMove, restore, setError } = store.getState()
    const byId = (id: ID | null) => (id ? tasks.find((t) => t.id === id) : undefined)
    const lastInColumn = tasks
      .filter((t) => t.status === status && t.id !== taskId)
      .sort(compareByPosition)
      .at(-1)
    const position =
      beforeId || afterId
        ? positionBetween(byId(beforeId)?.position, byId(afterId)?.position)
        : positionBetween(lastInColumn?.position, null)

    const snapshot = tasks
    setError(null)
    applyMove(taskId, status, position, new Date())
    startTransition(async () => {
      const result = await moveTaskAction({ taskId, status, beforeId, afterId })
      if (!result.ok) {
        restore(snapshot)
        fail(result.error)
      }
    })
  }

  const create = (input: TaskForm, onDone?: () => void) => {
    startTransition(async () => {
      const result = await createTaskAction({ ...input, projectId: store.getState().projectId })
      if (!result.ok) return fail(result.error)
      store.getState().upsertTask(result.data)
      onDone?.()
    })
  }

  const update = (id: ID, input: TaskForm, onDone?: () => void) => {
    startTransition(async () => {
      const result = await updateTaskAction(id, input)
      if (!result.ok) return fail(result.error)
      store.getState().upsertTask(result.data)
      onDone?.()
    })
  }

  const remove = (id: ID, onDone?: () => void) => {
    const { tasks, removeTask, restore } = store.getState()
    const snapshot = tasks
    removeTask(id)
    onDone?.()
    startTransition(async () => {
      const result = await deleteTaskAction(id)
      if (!result.ok) {
        restore(snapshot)
        fail(result.error)
      }
    })
  }

  return { move, create, update, remove, pending }
}
