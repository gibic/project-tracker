'use server'

import { revalidatePath } from 'next/cache'

import {
  createTask,
  deleteTask,
  moveTask,
  updateTask,
  type CreateTaskInput,
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
