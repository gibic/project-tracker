import type { Metadata } from 'next'

import { getNoteEditorOptions } from '@/application/notes/useCases'
import { NoteEditor } from '@/features/notes/components/NoteEditor'
import { PageHeader } from '@/features/shared/PageHeader'
import { getAppContext } from '@/features/shared/server'

export const metadata: Metadata = { title: 'New note' }

type Props = { searchParams: Promise<{ title?: string; projectId?: string; taskId?: string }> }

export default async function NewNotePage({ searchParams }: Props) {
  const { title, projectId, taskId } = await searchParams
  const { projects, tasks } = await getNoteEditorOptions(await getAppContext())

  return (
    <>
      <PageHeader title="New note" />
      <NoteEditor
        projects={projects}
        tasks={tasks}
        defaults={{
          title,
          projectIds: projectId ? [projectId] : [],
          taskIds: taskId ? [taskId] : [],
        }}
      />
    </>
  )
}
