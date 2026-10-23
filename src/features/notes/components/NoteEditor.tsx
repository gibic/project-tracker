'use client'

import { useState, useTransition } from 'react'

import type { Note } from '@/domain/notes/note'
import type { Project } from '@/domain/projects/project'
import type { ID } from '@/domain/shared/types'
import type { Task } from '@/domain/tasks/task'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utilities/ui'
import { previewNoteAction, saveNoteAction } from '../actions'
import { NoteHtml } from './NoteHtml'

export interface NoteEditorProps {
  note?: Note
  projects: Project[]
  tasks: Task[]
  defaults?: { title?: string; projectIds?: ID[]; taskIds?: ID[] }
}

export function NoteEditor({ note, projects, tasks, defaults = {} }: NoteEditorProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<{ message: string; field?: string } | null>(null)
  const [body, setBody] = useState(note?.body ?? '')
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [previewHtml, setPreviewHtml] = useState('')
  const [projectIds, setProjectIds] = useState<ID[]>(note?.projectIds ?? defaults.projectIds ?? [])
  const [taskIds, setTaskIds] = useState<ID[]>(note?.taskIds ?? defaults.taskIds ?? [])

  const toggle = (list: ID[], id: ID, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id))

  const showPreview = () => {
    setTab('preview')
    startTransition(async () => {
      const result = await previewNoteAction(body)
      setPreviewHtml(result.ok ? result.data : `<p>${result.error}</p>`)
    })
  }

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveNoteAction(note?.id ?? null, {
        title: formData.get('title'),
        body,
        tags: formData.get('tags'),
        projectIds,
        taskIds,
      })
      // Success redirects; only failures come back.
      if (result && !result.ok) setError({ message: result.error, field: result.field })
    })
  }

  const tasksByProject = projects
    .map((project) => ({ project, tasks: tasks.filter((t) => t.projectId === project.id) }))
    .filter((group) => group.tasks.length > 0)

  return (
    <form action={submit} className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="note-title">Title</Label>
          <Input
            id="note-title"
            name="title"
            defaultValue={note?.title ?? defaults.title}
            required
            maxLength={200}
            aria-invalid={error?.field === 'title' || undefined}
            className="text-lg font-medium"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="note-body">Content</Label>
            <div className="flex gap-1 text-sm" role="tablist">
              {(['write', 'preview'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => (value === 'preview' ? showPreview() : setTab('write'))}
                  className={cn(
                    'rounded-md px-2 py-0.5 capitalize',
                    tab === value ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          {tab === 'write' ? (
            <Textarea
              id="note-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={20}
              className="min-h-96 font-mono text-sm"
              placeholder={'Markdown supported. Link other notes with [[Note title]].'}
            />
          ) : (
            <div className="min-h-96 rounded-md border px-4 py-3">
              {previewHtml ? <NoteHtml html={previewHtml} /> : <p className="text-sm text-muted-foreground">Rendering…</p>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Headings, lists, checklists, quotes, links, **bold**, _italic_, `code`. Use [[Title]] to link notes.
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="note-tags">Tags</Label>
          <Input id="note-tags" name="tags" defaultValue={note?.tags.join(', ')} placeholder="research, ideas" />
          <p className="text-xs text-muted-foreground">Comma separated.</p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Projects</legend>
          {projects.length === 0 && <p className="text-xs text-muted-foreground">No active projects.</p>}
          {projects.map((project) => (
            <label key={project.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={projectIds.includes(project.id)}
                onCheckedChange={(on) => setProjectIds((ids) => toggle(ids, project.id, on === true))}
              />
              <span className="min-w-0 [overflow-wrap:anywhere]">{project.name}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">Tasks</legend>
          {tasksByProject.length === 0 && <p className="text-xs text-muted-foreground">No open tasks.</p>}
          {tasksByProject.map(({ project, tasks }) => (
            <div key={project.id} className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{project.name}</span>
              {tasks.map((task) => (
                <label key={task.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={taskIds.includes(task.id)}
                    onCheckedChange={(on) => setTaskIds((ids) => toggle(ids, task.id, on === true))}
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{task.title}</span>
                </label>
              ))}
            </div>
          ))}
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-destructive-foreground">
            {error.message}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {note ? 'Save note' : 'Create note'}
        </Button>
      </div>
    </form>
  )
}
