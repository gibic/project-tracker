import type { Metadata } from 'next'

import { getNote, getNoteEditorOptions } from '@/application/notes/useCases'
import { NoteEditor } from '@/features/notes/components/NoteEditor'
import { PageHeader } from '@/features/shared/PageHeader'
import { loadOrNotFound } from '@/features/shared/server'

export const metadata: Metadata = { title: 'Edit note' }

type Props = { params: Promise<{ id: string }> }

export default async function EditNotePage({ params }: Props) {
  const { id } = await params
  const { note, options } = await loadOrNotFound(async (ctx) => {
    const { note } = await getNote(ctx, id)
    return { note, options: await getNoteEditorOptions(ctx, note.taskIds) }
  })

  return (
    <>
      <PageHeader title="Edit note" />
      <NoteEditor note={note} projects={options.projects} tasks={options.tasks} />
    </>
  )
}
