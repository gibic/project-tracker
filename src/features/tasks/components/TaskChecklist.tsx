'use client'

import { GripVerticalIcon, PlusIcon, XIcon } from 'lucide-react'
import { useMemo, useState, type DragEvent, type KeyboardEvent } from 'react'

import type { ID } from '@/domain/shared/types'
import type { ChecklistItem } from '@/domain/tasks/checklist'
import type { Task } from '@/domain/tasks/task'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { CHECKLIST_TEXT_MAX, checklistProgress } from '@/domain/tasks/checklist'
import { cn } from '@/utilities/ui'
import { ProgressBar } from '../../projects/ProgressBar'
import { SectionHeading } from '../../shared/headings'
import { useBoardStore } from '../BoardStoreProvider'
import { useTaskMutations } from '../useTaskMutations'

/**
 * Subtasks of the open task. Every change saves immediately (independent of the
 * task form's Save button). Rendered inside the task form, so no nested <form>.
 */
export function TaskChecklist({ task, readOnly }: { task: Task; readOnly: boolean }) {
  const color = useBoardStore((s) => s.projectColor)
  const { checklist } = useTaskMutations()
  const [draft, setDraft] = useState('')
  // Only the handle starts a drag, so text inside a row stays selectable.
  const [armedId, setArmedId] = useState<ID | null>(null)
  const [draggingId, setDraggingId] = useState<ID | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const items = task.checklist
  const progress = useMemo(() => checklistProgress(items), [items])
  // Drop slots are counted without the dragged item, like board columns.
  const others = useMemo(() => items.filter((i) => i.id !== draggingId), [items, draggingId])

  const add = () => {
    const text = draft.trim()
    if (!text) return
    checklist.add(task.id, text)
    setDraft('')
  }

  const endDrag = () => {
    setArmedId(null)
    setDraggingId(null)
    setDropIndex(null)
  }

  const drop = (event: DragEvent) => {
    event.preventDefault()
    if (!draggingId) return
    const index = dropIndex ?? others.length
    checklist.move(task.id, draggingId, others[index - 1]?.id ?? null, others[index]?.id ?? null)
    endDrag()
  }

  /** Keyboard reordering from the drag handle. */
  const moveBy = (item: ChecklistItem, delta: -1 | 1) => {
    const index = items.indexOf(item)
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const rest = items.filter((i) => i.id !== item.id)
    checklist.move(task.id, item.id, rest[target - 1]?.id ?? null, rest[target]?.id ?? null)
  }

  if (readOnly && items.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading as="h3">Checklist</SectionHeading>
        {items.length > 0 && (
          <div className="w-32">
            <ProgressBar progress={progress} color={color} compact label="Checklist progress" />
          </div>
        )}
      </div>

      {items.length > 0 && (
        <ul
          className="flex flex-col"
          onDragOver={(event) => {
            if (!draggingId) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={drop}
        >
          {items.map((item) => {
            const index = others.indexOf(item)
            return (
              <li
                key={item.id}
                draggable={armedId === item.id}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', item.id)
                  setDraggingId(item.id)
                }}
                onDragEnd={endDrag}
                onDragOver={(event) => {
                  if (!draggingId || item.id === draggingId) return
                  const rect = event.currentTarget.getBoundingClientRect()
                  setDropIndex(event.clientY > rect.top + rect.height / 2 ? index + 1 : index)
                }}
                className={cn(
                  'group relative flex items-center gap-2 rounded-sm py-0.5',
                  item.id === draggingId && 'opacity-40',
                  draggingId &&
                    dropIndex === index &&
                    'before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:rounded-full before:bg-primary',
                  draggingId &&
                    dropIndex === others.length &&
                    index === others.length - 1 &&
                    'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary',
                )}
              >
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Reorder "${item.text}" (arrow keys move it)`}
                    className="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
                    onPointerDown={() => setArmedId(item.id)}
                    onPointerUp={() => setArmedId(null)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault()
                        moveBy(item, event.key === 'ArrowUp' ? -1 : 1)
                      }
                    }}
                  >
                    <GripVerticalIcon className="size-3.5" />
                  </button>
                )}
                <Checkbox
                  checked={item.done}
                  disabled={readOnly}
                  aria-label={`Mark "${item.text}" ${item.done ? 'not done' : 'done'}`}
                  onCheckedChange={(checked) => checklist.update(task.id, item.id, { done: checked === true })}
                />
                <ItemText
                  item={item}
                  readOnly={readOnly}
                  onCommit={(text) => checklist.update(task.id, item.id, { text })}
                />
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Delete "${item.text}"`}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                    onClick={() => checklist.remove(task.id, item.id)}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2">
          <PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            aria-label="Add checklist item"
            placeholder="Add an item…"
            value={draft}
            maxLength={CHECKLIST_TEXT_MAX}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter would submit the surrounding task form.
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            className="h-7 border-none px-1 shadow-none focus-visible:ring-0 md:text-sm"
          />
        </div>
      )}
    </div>
  )
}

/** Inline-editable text. Saves on blur or Enter; Escape or an empty value reverts. */
function ItemText({
  item,
  readOnly,
  onCommit,
}: {
  item: ChecklistItem
  readOnly: boolean
  onCommit: (text: string) => void
}) {
  const className = cn(
    'min-w-0 flex-1 text-sm [overflow-wrap:anywhere]',
    item.done && 'text-muted-foreground line-through',
  )
  if (readOnly) return <span className={className}>{item.text}</span>

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    if (event.key === 'Enter') {
      event.preventDefault()
      input.blur()
    } else if (event.key === 'Escape' && input.value !== item.text) {
      // Revert instead of closing the dialog.
      event.preventDefault()
      input.value = item.text
      input.blur()
    }
  }

  return (
    <input
      // Remount when the saved text changes so the uncontrolled value follows the store.
      key={item.text}
      aria-label="Checklist item"
      defaultValue={item.text}
      maxLength={CHECKLIST_TEXT_MAX}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        const text = event.currentTarget.value.trim()
        if (!text) event.currentTarget.value = item.text
        else if (text !== item.text) onCommit(text)
      }}
      className={cn(className, 'rounded-sm bg-transparent px-1 py-0.5 outline-none focus-visible:bg-accent')}
    />
  )
}
