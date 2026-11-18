'use client'

import { useTransition } from 'react'

import type { ID } from '@/domain/shared/types'
import type { ChecklistItem } from '@/domain/tasks/checklist'
import type { Task, TaskInput, TaskStatus } from '@/domain/tasks/task'
import type { ActionResult } from '../shared/actionResult'

import { isDomainError } from '@/domain/shared/errors'
import {
  addChecklistItem,
  moveChecklistItem,
  parseChecklistText,
  removeChecklistItem,
  updateChecklistItem,
} from '@/domain/tasks/checklist'
import { compareByPosition, positionBetween } from '@/domain/tasks/task'
import {
  addChecklistItemAction,
  createTaskAction,
  deleteTaskAction,
  duplicateTaskAction,
  moveChecklistItemAction,
  moveTaskAction,
  removeChecklistItemAction,
  updateChecklistItemAction,
  updateTaskAction,
} from './actions'
import { useBoardStoreApi } from './BoardStoreProvider'

type TaskForm = Partial<Record<keyof TaskInput, unknown>> & { status?: unknown }

/** `crypto.randomUUID` needs a secure context; plain-http LAN access only has `getRandomValues`. */
const randomUUID = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

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

  /** Opens the copy once the server has created it. */
  const duplicate = (id: ID) => {
    startTransition(async () => {
      const result = await duplicateTaskAction(id)
      if (!result.ok) return fail(result.error)
      store.getState().upsertTask(result.data)
      store.getState().openTask(result.data.id)
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

  /**
   * Applies a checklist change locally with the same domain function the server uses,
   * then persists it. The revalidated page brings the server's copy back into the store.
   */
  const changeChecklist = (
    taskId: ID,
    change: (items: ChecklistItem[]) => ChecklistItem[],
    persist: () => Promise<ActionResult<Task>>,
  ) => {
    const { tasks, setChecklist, setError } = store.getState()
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    let next: ChecklistItem[]
    try {
      next = change(task.checklist)
    } catch (error) {
      if (isDomainError(error)) return fail(error.message)
      throw error
    }
    setError(null)
    setChecklist(taskId, next)
    startTransition(async () => {
      const result = await persist()
      if (!result.ok) {
        store.getState().setChecklist(taskId, task.checklist)
        fail(result.error)
      }
    })
  }

  const checklist = {
    add: (taskId: ID, text: string) => {
      const id = randomUUID()
      changeChecklist(
        taskId,
        (items) => addChecklistItem(items, { id, text: parseChecklistText(text) }),
        () => addChecklistItemAction(taskId, { id, text }),
      )
    },
    update: (taskId: ID, itemId: ID, patch: { text?: string; done?: boolean }) =>
      changeChecklist(
        taskId,
        (items) =>
          updateChecklistItem(items, itemId, {
            ...patch,
            ...(patch.text !== undefined && { text: parseChecklistText(patch.text) }),
          }),
        () => updateChecklistItemAction(taskId, itemId, patch),
      ),
    /** `beforeId`/`afterId` are the items that end up directly above/below. */
    move: (taskId: ID, itemId: ID, beforeId: ID | null, afterId: ID | null) =>
      changeChecklist(
        taskId,
        (items) => moveChecklistItem(items, itemId, { beforeId, afterId }),
        () => moveChecklistItemAction(taskId, itemId, { beforeId, afterId }),
      ),
    remove: (taskId: ID, itemId: ID) =>
      changeChecklist(
        taskId,
        (items) => removeChecklistItem(items, itemId),
        () => removeChecklistItemAction(taskId, itemId),
      ),
  }

  return { move, create, update, duplicate, remove, checklist, pending }
}
