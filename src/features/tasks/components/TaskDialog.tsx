'use client'

import { NotebookPenIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'

import type { NoteSummary } from '@/domain/notes/note'
import type { ID } from '@/domain/shared/types'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { TASK_PRIORITIES, TASK_STATUSES } from '@/domain/tasks/task'
import { toDateInputValue } from '../../shared/format'
import { useBoardStore } from '../BoardStoreProvider'
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from '../labels'
import { useTaskMutations } from '../useTaskMutations'

export function TaskDialog({
  readOnly,
  notesByTask,
}: {
  readOnly: boolean
  notesByTask: Record<ID, NoteSummary[]>
}) {
  const task = useBoardStore((s) => s.tasks.find((t) => t.id === s.editingTaskId) ?? null)
  const projectId = useBoardStore((s) => s.projectId)
  const closeTask = useBoardStore((s) => s.closeTask)
  const { update, remove, pending } = useTaskMutations()

  const submit = (formData: FormData) => {
    if (!task) return
    update(
      task.id,
      {
        title: formData.get('title'),
        description: formData.get('description'),
        status: formData.get('status'),
        priority: formData.get('priority'),
        dueDate: formData.get('dueDate'),
      },
      closeTask,
    )
  }

  const notes = task ? (notesByTask[task.id] ?? []) : []

  return (
    <Dialog open={task !== null} onClose={closeTask} title={readOnly ? 'Task' : 'Edit task'}>
      {task && (
        // `key` resets the uncontrolled form when another task opens.
        <form key={task.id} action={submit} className="flex flex-col gap-4">
          <fieldset disabled={readOnly} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" name="title" defaultValue={task.title} required maxLength={200} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea id="task-description" name="description" defaultValue={task.description} rows={4} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-status">Status</Label>
                <NativeSelect id="task-status" name="status" defaultValue={task.status}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-priority">Priority</Label>
                <NativeSelect id="task-priority" name="priority" defaultValue={task.priority}>
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-due">Due date</Label>
                <Input id="task-due" name="dueDate" type="date" defaultValue={toDateInputValue(task.dueDate)} />
              </div>
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Linked notes</span>
              <Link
                href={`/notes/new?projectId=${projectId}&taskId=${task.id}`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <PlusIcon className="size-3" /> New note
              </Link>
            </div>
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notes for this task.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {notes.map((note) => (
                  <li key={note.id}>
                    <Link href={`/notes/${note.id}`} className="inline-flex items-center gap-1.5 text-sm hover:underline">
                      <NotebookPenIcon className="size-3.5 text-muted-foreground" />
                      {note.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive-foreground"
                onClick={() => {
                  if (confirm(`Delete "${task.title}"?`)) remove(task.id, closeTask)
                }}
              >
                <Trash2Icon />
                Delete
              </Button>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
            </div>
          )}
        </form>
      )}
    </Dialog>
  )
}
