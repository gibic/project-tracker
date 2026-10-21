'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PROJECT_COLORS, type Project, type ProjectColor } from '@/domain/projects/project'
import { cn } from '@/utilities/ui'
import { createProjectAction, updateProjectAction } from './actions'
import { projectDotClass } from './colors'

/** Create form when `project` is missing, edit form otherwise. */
export function ProjectForm({ project, onDone }: { project?: Project; onDone?: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [color, setColor] = useState<ProjectColor>(project?.color ?? 'sky')

  const submit = (formData: FormData) => {
    const input = { name: formData.get('name'), description: formData.get('description'), color }
    startTransition(async () => {
      const result = project ? await updateProjectAction(project.id, input) : await createProjectAction(input)
      if (!result.ok) return setError(result.error)
      setError(null)
      onDone?.()
      if (!project) router.push(`/projects/${result.data.id}`)
    })
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-name">Name</Label>
        <Input id="project-name" name="name" defaultValue={project?.name} required maxLength={80} autoFocus />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea id="project-description" name="description" defaultValue={project?.description} rows={3} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Color</legend>
        <div className="flex gap-2">
          {PROJECT_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={value}
              aria-pressed={color === value}
              onClick={() => setColor(value)}
              className={cn(
                'size-6 rounded-full ring-offset-2 ring-offset-background transition',
                projectDotClass[value],
                color === value && 'ring-2 ring-foreground',
              )}
            />
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {project ? 'Save' : 'Create project'}
        </Button>
      </div>
    </form>
  )
}
