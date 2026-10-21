'use client'

import { KanbanIcon, ListIcon, XIcon } from 'lucide-react'
import { useMemo } from 'react'

import type { NoteSummary } from '@/domain/notes/note'
import type { ID } from '@/domain/shared/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { TASK_PRIORITIES, type TaskPriority } from '@/domain/tasks/task'
import { cn } from '@/utilities/ui'
import { useUIStore } from '../../shell/uiStore'
import { useBoardStore } from '../BoardStoreProvider'
import { PRIORITY_LABELS } from '../labels'
import { KanbanBoard } from './KanbanBoard'
import { QuickAddTask } from './QuickAddTask'
import { TaskDialog } from './TaskDialog'
import { TaskList } from './TaskList'

/** Client root of a project's task area. Must be rendered inside `BoardStoreProvider`. */
export function TaskBoard({ readOnly, notesByTask }: { readOnly: boolean; notesByTask: Record<ID, NoteSummary[]> }) {
  const view = useUIStore((s) => s.projectView)
  const setView = useUIStore((s) => s.setProjectView)
  const filter = useBoardStore((s) => s.filter)
  const setFilter = useBoardStore((s) => s.setFilter)
  const error = useBoardStore((s) => s.error)
  const setError = useBoardStore((s) => s.setError)

  const noteCounts = useMemo(
    () => Object.fromEntries(Object.entries(notesByTask).map(([id, notes]) => [id, notes.length])),
    [notesByTask],
  )

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && <QuickAddTask />}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder="Filter tasks…"
          aria-label="Filter tasks"
          value={filter.query}
          onChange={(e) => setFilter({ query: e.target.value })}
          className="w-56"
        />
        <NativeSelect
          aria-label="Filter by priority"
          value={filter.priority}
          onChange={(e) => setFilter({ priority: e.target.value as TaskPriority | 'all' })}
          className="w-36"
        >
          <option value="all">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </NativeSelect>
        <div className="ml-auto flex rounded-md border p-0.5" role="group" aria-label="View">
          {(
            [
              ['board', KanbanIcon, 'Board'],
              ['list', ListIcon, 'List'],
            ] as const
          ).map(([value, Icon, label]) => (
            <Button
              key={value}
              size="sm"
              variant="ghost"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={cn('h-8', view === value && 'bg-accent')}
            >
              <Icon />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between rounded-md border border-error bg-error/30 px-3 py-2 text-sm">
          {error}
          <button type="button" aria-label="Dismiss" onClick={() => setError(null)}>
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {view === 'board' ? (
        <KanbanBoard readOnly={readOnly} noteCounts={noteCounts} />
      ) : (
        <TaskList readOnly={readOnly} noteCounts={noteCounts} />
      )}

      <TaskDialog readOnly={readOnly} notesByTask={notesByTask} />
    </div>
  )
}
