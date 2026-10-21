'use client'

import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useState, useTransition } from 'react'

import type { Project } from '@/domain/projects/project'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { deleteProjectAction, setProjectArchivedAction } from './actions'
import { ProjectForm } from './ProjectForm'

export function ProjectActions({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const archived = project.status === 'archived'

  const run = (action: () => Promise<{ ok: boolean; error?: string } | undefined>) =>
    startTransition(async () => {
      const result = await action()
      setError(result && !result.ok ? (result.error ?? null) : null)
    })

  return (
    <>
      {!archived && (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon />
          Edit
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(() => setProjectArchivedAction(project.id, !archived))}
      >
        {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
        {archived ? 'Restore' : 'Archive'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${project.name}" and all its tasks? Linked notes are kept.`)) {
            run(() => deleteProjectAction(project.id))
          }
        }}
      >
        <Trash2Icon />
        Delete
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-destructive-foreground">
          {error}
        </p>
      )}
      <Dialog open={editing} onClose={() => setEditing(false)} title="Edit project">
        <ProjectForm project={project} onDone={() => setEditing(false)} />
      </Dialog>
    </>
  )
}
