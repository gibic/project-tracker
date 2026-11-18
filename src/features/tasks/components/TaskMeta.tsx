'use client'

import { CalendarIcon, NotebookPenIcon, RepeatIcon } from 'lucide-react'

import type { Task } from '@/domain/tasks/task'

import { TASK_RECURRENCE_LABELS } from '@/domain/tasks/recurrence'
import { isOverdue } from '@/domain/tasks/task'
import { APP_TIME_ZONE } from '@/utilities/timeZone'
import { cn } from '@/utilities/ui'
import { formatDueDate } from '../../shared/format'
import { PriorityBadge } from './PriorityBadge'

export function TaskMeta({ task, noteCount = 0 }: { task: Task; noteCount?: number }) {
  const overdue = isOverdue(task, new Date(), APP_TIME_ZONE)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <PriorityBadge priority={task.priority} />
      {task.dueDate && (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs',
            overdue ? 'font-medium text-destructive-foreground' : 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="size-3" />
          {formatDueDate(task.dueDate)}
          {overdue && ' · overdue'}
        </span>
      )}
      {task.recurrence && (
        <span
          className="inline-flex items-center text-muted-foreground"
          title={TASK_RECURRENCE_LABELS[task.recurrence]}
          aria-label={TASK_RECURRENCE_LABELS[task.recurrence]}
        >
          <RepeatIcon className="size-3" />
        </span>
      )}
      {noteCount > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <NotebookPenIcon className="size-3" />
          {noteCount}
        </span>
      )}
    </div>
  )
}
