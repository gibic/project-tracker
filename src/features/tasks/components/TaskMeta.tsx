'use client'

import { CalendarIcon, NotebookPenIcon } from 'lucide-react'

import type { Task } from '@/domain/tasks/task'

import { Badge } from '@/components/ui/badge'
import { isOverdue } from '@/domain/tasks/task'
import { cn } from '@/utilities/ui'
import { formatDueDate } from '../../shared/format'
import { PRIORITY_LABELS, priorityBadgeVariant } from '../labels'

export function TaskMeta({ task, noteCount = 0 }: { task: Task; noteCount?: number }) {
  const overdue = isOverdue(task, new Date())
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={priorityBadgeVariant[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
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
      {noteCount > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <NotebookPenIcon className="size-3" />
          {noteCount}
        </span>
      )}
    </div>
  )
}
