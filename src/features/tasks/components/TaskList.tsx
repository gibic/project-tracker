'use client'

import { useMemo } from 'react'

import type { ID } from '@/domain/shared/types'

import { Checkbox } from '@/components/ui/checkbox'
import { TASK_STATUSES, compareByUrgency } from '@/domain/tasks/task'
import { cn } from '@/utilities/ui'
import { useBoardStore } from '../BoardStoreProvider'
import { visibleColumn } from '../boardStore'
import { TASK_STATUS_LABELS } from '../labels'
import { useTaskMutations } from '../useTaskMutations'
import { TaskMeta } from './TaskMeta'

/** Compact list grouped by status, open tasks sorted by urgency. */
export function TaskList({ readOnly, noteCounts }: { readOnly: boolean; noteCounts: Record<ID, number> }) {
  const tasks = useBoardStore((s) => s.tasks)
  const filter = useBoardStore((s) => s.filter)
  const openTask = useBoardStore((s) => s.openTask)
  const { move } = useTaskMutations()

  const groups = useMemo(
    () =>
      TASK_STATUSES.map((status) => {
        const column = visibleColumn(tasks, filter, status)
        return { status, tasks: status === 'done' ? column : [...column].sort(compareByUrgency) }
      }),
    [tasks, filter],
  )

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ status, tasks }) => (
        <section key={status}>
          <h2 className="mb-2 text-sm font-medium">
            {TASK_STATUS_LABELS[status]} <span className="text-muted-foreground">({tasks.length})</span>
          </h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 px-3 py-2">
                  <Checkbox
                    aria-label={task.status === 'done' ? 'Mark as not done' : 'Mark as done'}
                    checked={task.status === 'done'}
                    disabled={readOnly}
                    onCheckedChange={(checked) => move(task.id, checked ? 'done' : 'todo', null, null)}
                  />
                  <button
                    type="button"
                    onClick={() => openTask(task.id)}
                    className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 text-left"
                  >
                    <span
                      className={cn(
                        'min-w-0 max-w-full line-clamp-2 text-sm [overflow-wrap:anywhere]',
                        task.status === 'done' && 'text-muted-foreground line-through',
                      )}
                    >
                      {task.title}
                    </span>
                    <TaskMeta task={task} noteCount={noteCounts[task.id] ?? 0} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
