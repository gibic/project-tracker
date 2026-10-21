'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  createNote,
  deleteNote,
  previewMarkdown,
  updateNote,
  type NoteFormInput,
} from '@/application/notes/useCases'
import { runAction } from '../shared/actionResult'

const refresh = () => revalidatePath('/', 'layout')

/** Creates when `id` is null, otherwise updates. Redirects to the note on success. */
export async function saveNoteAction(id: string | null, input: NoteFormInput) {
  const result = await runAction((ctx) => (id ? updateNote(ctx, id, input) : createNote(ctx, input)))
  if (!result.ok) return result
  refresh()
  redirect(`/notes/${result.data.id}`)
}

export async function deleteNoteAction(id: string) {
  const result = await runAction((ctx) => deleteNote(ctx, id))
  if (!result.ok) return result
  refresh()
  redirect('/notes')
}

export async function previewNoteAction(markdown: string) {
  return runAction((ctx) => previewMarkdown(ctx, markdown))
}
