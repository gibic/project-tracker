'use server'

import { revalidatePath } from 'next/cache'

import {
  addChecklistItem,
  createTask,
  deleteTask,
  moveChecklistItem,
  moveTask,
  removeChecklistItem,
  updateChecklistItem,
  updateTask,
  type AddChecklistItemInput,
  type CreateTaskInput,
  type MoveChecklistItemInput,
  type MoveTaskInput,
} from '@/application/tasks/useCases'
import type { TaskInput } from '@/domain/tasks/task'
import { runAction } from '../shared/actionResult'

// Task changes affect the board, the dashboard and sidebar progress.
const refresh = () => revalidatePath('/', 'layout')

export async function createTaskAction(input: CreateTaskInput) {
  const result = await runAction((ctx) => createTask(ctx, input))
  if (result.ok) refresh()
  return result
}

export async function updateTaskAction(
  id: string,
  input: Partial<Record<keyof TaskInput, unknown>> & { status?: unknown },
) {
  const result = await runAction((ctx) => updateTask(ctx, id, input))
  if (result.ok) refresh()
  return result
}

export async function moveTaskAction(input: MoveTaskInput) {
  const result = await runAction((ctx) => moveTask(ctx, input))
  if (result.ok) refresh()
  return result
}

export async function deleteTaskAction(id: string) {
  const result = await runAction((ctx) => deleteTask(ctx, id))
  if (result.ok) refresh()
  return result
}

export async function addChecklistItemAction(taskId: string, input: AddChecklistItemInput) {
  const result = await runAction((ctx) => addChecklistItem(ctx, taskId, input))
  if (result.ok) refresh()
  return result
}

export async function updateChecklistItemAction(
  taskId: string,
  itemId: string,
  input: { text?: unknown; done?: unknown },
) {
  const result = await runAction((ctx) => updateChecklistItem(ctx, taskId, itemId, input))
  if (result.ok) refresh()
  return result
}

export async function moveChecklistItemAction(taskId: string, itemId: string, input: MoveChecklistItemInput) {
  const result = await runAction((ctx) => moveChecklistItem(ctx, taskId, itemId, input))
  if (result.ok) refresh()
  return result
}

export async function removeChecklistItemAction(taskId: string, itemId: string) {
  const result = await runAction((ctx) => removeChecklistItem(ctx, taskId, itemId))
  if (result.ok) refresh()
  return result
}
