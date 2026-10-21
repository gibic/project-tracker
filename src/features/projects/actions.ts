'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { ProjectInput } from '@/domain/projects/project'

import {
  createProject,
  deleteProject,
  setProjectArchived,
  updateProject,
} from '@/application/projects/useCases'
import { runAction } from '../shared/actionResult'

type ProjectForm = Partial<Record<keyof ProjectInput, unknown>>

// Projects appear in the sidebar, so refresh the whole workspace layout.
const refresh = () => revalidatePath('/', 'layout')

export async function createProjectAction(input: ProjectForm) {
  const result = await runAction((ctx) => createProject(ctx, input))
  if (result.ok) refresh()
  return result
}

export async function updateProjectAction(id: string, input: ProjectForm) {
  const result = await runAction((ctx) => updateProject(ctx, id, input))
  if (result.ok) refresh()
  return result
}

export async function setProjectArchivedAction(id: string, archived: boolean) {
  const result = await runAction((ctx) => setProjectArchived(ctx, id, archived))
  if (result.ok) refresh()
  return result
}

export async function deleteProjectAction(id: string) {
  const result = await runAction((ctx) => deleteProject(ctx, id))
  if (!result.ok) return result
  refresh()
  redirect('/projects')
}
