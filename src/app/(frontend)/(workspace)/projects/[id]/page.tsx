import type { Metadata } from 'next'
import { NotebookPenIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { cache } from 'react'

import { getProjectBoard } from '@/application/projects/useCases'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { projectDotClass } from '@/features/projects/colors'
import { ProgressBar } from '@/features/projects/ProgressBar'
import { ProjectActions } from '@/features/projects/ProjectActions'
import { PageHeader } from '@/features/shared/PageHeader'
import { loadOrNotFound } from '@/features/shared/server'
import { BoardStoreProvider } from '@/features/tasks/BoardStoreProvider'
import { TaskBoard } from '@/features/tasks/components/TaskBoard'
import { cn } from '@/utilities/ui'

type Props = { params: Promise<{ id: string }> }

// Shared by generateMetadata and the page within one request.
const loadBoard = cache((id: string) => loadOrNotFound((ctx) => getProjectBoard(ctx, id)))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const { project } = await loadBoard(id)
  return { title: project.name }
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const { project, tasks, notes, notesByTask } = await loadBoard(id)
  const readOnly = project.status === 'archived'

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className={cn('size-3 rounded-full', projectDotClass[project.color])} />
            {project.name}
            {readOnly && <Badge variant="outline">Archived</Badge>}
          </span>
        }
        description={project.description || undefined}
        actions={<ProjectActions project={project} />}
      />

      <div className="mb-6 max-w-md">
        <ProgressBar progress={project.progress} color={project.color} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_18rem]">
        <BoardStoreProvider projectId={project.id} tasks={tasks}>
          <TaskBoard readOnly={readOnly} notesByTask={notesByTask} />
        </BoardStoreProvider>

        <aside className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Project notes</h2>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/notes/new?projectId=${project.id}`}>
                <PlusIcon />
                New
              </Link>
            </Button>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes linked to this project.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link href={`/notes/${note.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                    <NotebookPenIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{note.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  )
}
