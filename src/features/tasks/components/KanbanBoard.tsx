'use client'

import { useMemo, type DragEvent } from 'react'

import type { ID } from '@/domain/shared/types'
import type { Task, TaskStatus } from '@/domain/tasks/task'

import { TASK_STATUSES } from '@/domain/tasks/task'
import { cn } from '@/utilities/ui'
import { useBoardStore } from '../BoardStoreProvider'
import { visibleColumn } from '../boardStore'
import { TASK_STATUS_LABELS } from '../labels'
import { useTaskMutations } from '../useTaskMutations'
import { TaskMeta } from './TaskMeta'

export function KanbanBoard({ readOnly, noteCounts }: { readOnly: boolean; noteCounts: Record<ID, number> }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {TASK_STATUSES.map((status) => (
        <Column key={status} status={status} readOnly={readOnly} noteCounts={noteCounts} />
      ))}
    </div>
  )
}

function Column({
  status,
  readOnly,
  noteCounts,
}: {
  status: TaskStatus
  readOnly: boolean
  noteCounts: Record<ID, number>
}) {
  const tasks = useBoardStore((s) => s.tasks)
  const filter = useBoardStore((s) => s.filter)
  const draggingTaskId = useBoardStore((s) => s.draggingTaskId)
  const dropTarget = useBoardStore((s) => s.dropTarget)
  const setDropTarget = useBoardStore((s) => s.setDropTarget)
  const endDrag = useBoardStore((s) => s.endDrag)
  const { move } = useTaskMutations()

  const column = useMemo(() => visibleColumn(tasks, filter, status), [tasks, filter, status])
  // Neighbours are computed without the dragged card so dropping in place is a no-op position-wise.
  const others = useMemo(() => column.filter((t) => t.id !== draggingTaskId), [column, draggingTaskId])

  const isTarget = dropTarget?.status === status

  const onDragOver = (event: DragEvent) => {
    if (readOnly || !draggingTaskId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (event.target === event.currentTarget) setDropTarget({ status, index: others.length })
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    if (readOnly || !draggingTaskId) return
    const index = dropTarget?.status === status ? dropTarget.index : others.length
    move(draggingTaskId, status, others[index - 1]?.id ?? null, others[index]?.id ?? null)
    endDrag()
  }

  return (
    <section
      aria-label={TASK_STATUS_LABELS[status]}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'flex min-h-48 flex-col gap-2 rounded-lg border bg-card/60 p-3 transition-colors',
        isTarget && 'border-foreground/30 bg-accent/60',
      )}
    >
      <header className="flex items-center justify-between px-1 pb-1">
        <h2 className="text-sm font-medium">{TASK_STATUS_LABELS[status]}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{column.length}</span>
      </header>

      {column.map((task) => {
        // The dragged card stays mounted (removing a drag source cancels the drag) but takes no slot.
        if (task.id === draggingTaskId) {
          return (
            <div key={task.id} className="opacity-40">
              <TaskCard task={task} readOnly={readOnly} noteCount={noteCounts[task.id] ?? 0} onHover={() => {}} />
            </div>
          )
        }
        const index = others.indexOf(task)
        return (
          <div key={task.id}>
            {isTarget && dropTarget.index === index && <DropIndicator />}
            <TaskCard
              task={task}
              readOnly={readOnly}
              noteCount={noteCounts[task.id] ?? 0}
              onHover={(after) => setDropTarget({ status, index: after ? index + 1 : index })}
            />
          </div>
        )
      })}
      {isTarget && dropTarget.index >= others.length && <DropIndicator />}

      {column.length === 0 && !isTarget && (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">
          {readOnly ? 'Empty' : 'Drop tasks here'}
        </p>
      )}
    </section>
  )
}

const DropIndicator = () => <div className="mb-2 h-0.5 rounded-full bg-primary" />

function TaskCard({
  task,
  readOnly,
  noteCount,
  onHover,
}: {
  task: Task
  readOnly: boolean
  noteCount: number
  /** `after` is true when the pointer is on the lower half of the card. */
  onHover: (after: boolean) => void
}) {
  const startDrag = useBoardStore((s) => s.startDrag)
  const endDrag = useBoardStore((s) => s.endDrag)
  const openTask = useBoardStore((s) => s.openTask)

  return (
    <button
      type="button"
      draggable={!readOnly}
      onClick={() => openTask(task.id)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', task.id)
        startDrag(task.id)
      }}
      onDragEnd={endDrag}
      onDragOver={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onHover(event.clientY > rect.top + rect.height / 2)
      }}
      className={cn(
        'flex w-full flex-col gap-2 rounded-md border bg-background p-3 text-left shadow-xs transition hover:border-foreground/30',
        !readOnly && 'cursor-grab active:cursor-grabbing',
        task.status === 'done' && 'opacity-70',
      )}
    >
      <span className={cn('text-sm', task.status === 'done' && 'line-through')}>{task.title}</span>
      <TaskMeta task={task} noteCount={noteCount} />
    </button>
  )
}
