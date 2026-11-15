import type { ID } from '../shared/types'
import type { Completion } from './progress'

import { NotFoundError, ValidationError } from '../shared/errors'
import { requireText } from '../shared/validation'
import { POSITION_STEP, compareByPosition, positionBetween } from './task'

/** A subtask inside a task. Kept on the task itself so it never adds a card to the board. */
export interface ChecklistItem {
  id: ID
  text: string
  done: boolean
  /** Sort key inside the checklist, using the same fractional scheme as board columns. */
  position: number
}

export const CHECKLIST_TEXT_MAX = 500
export const CHECKLIST_MAX_ITEMS = 100

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const parseChecklistText = (value: unknown): string =>
  requireText(value, 'text', { max: CHECKLIST_TEXT_MAX })

/**
 * Item ids are stored as row keys shared by every task, so a client-chosen id
 * (used for optimistic adds) must be a UUID.
 */
export const parseChecklistItemId = (value: unknown): ID => {
  if (typeof value === 'string' && UUID.test(value)) return value.toLowerCase()
  throw new ValidationError('id must be a UUID', 'id')
}

/** Item texts for a new task. Blank lines are dropped. */
export const parseChecklistTexts = (value: unknown): string[] => {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new ValidationError('checklist must be a list of texts', 'checklist')
  const texts = value.filter((t) => typeof t !== 'string' || t.trim() !== '').map(parseChecklistText)
  if (texts.length > CHECKLIST_MAX_ITEMS) {
    throw new ValidationError(`A checklist can have at most ${CHECKLIST_MAX_ITEMS} items`, 'checklist')
  }
  return texts
}

export const sortChecklist = (items: readonly ChecklistItem[]): ChecklistItem[] =>
  [...items].sort(compareByPosition)

export const checklistProgress = (items: readonly Pick<ChecklistItem, 'done'>[]): Completion => {
  const total = items.length
  const done = items.filter((item) => item.done).length
  return { total, done, percent: total === 0 ? 0 : Math.floor((done / total) * 100) }
}

/** Evenly spaced positions in the current order; used when fractions run out or collide. */
const renumber = (items: readonly ChecklistItem[]): ChecklistItem[] =>
  items.map((item, index) => ({ ...item, position: (index + 1) * POSITION_STEP }))

const requireItem = (items: readonly ChecklistItem[], id: ID): ChecklistItem => {
  const item = items.find((i) => i.id === id)
  if (!item) throw new NotFoundError('Checklist item', id)
  return item
}

export const buildChecklist = (texts: readonly string[], ids: readonly ID[]): ChecklistItem[] =>
  texts.map((text, index) => ({ id: ids[index], text, done: false, position: (index + 1) * POSITION_STEP }))

/** Appends an item to the bottom of the checklist. */
export const addChecklistItem = (
  items: readonly ChecklistItem[],
  item: { id: ID; text: string },
): ChecklistItem[] => {
  if (items.length >= CHECKLIST_MAX_ITEMS) {
    throw new ValidationError(`A checklist can have at most ${CHECKLIST_MAX_ITEMS} items`, 'checklist')
  }
  if (items.some((i) => i.id === item.id)) throw new ValidationError('Checklist item already exists', 'id')
  const sorted = sortChecklist(items)
  return [...sorted, { ...item, done: false, position: positionBetween(sorted.at(-1)?.position, null) }]
}

export const updateChecklistItem = (
  items: readonly ChecklistItem[],
  id: ID,
  patch: { text?: string; done?: boolean },
): ChecklistItem[] => {
  requireItem(items, id)
  return sortChecklist(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
}

export const removeChecklistItem = (items: readonly ChecklistItem[], id: ID): ChecklistItem[] => {
  requireItem(items, id)
  return sortChecklist(items.filter((item) => item.id !== id))
}

/**
 * Moves an item between two others. `beforeId` ends up directly above it, `afterId`
 * directly below; with neither it goes to the bottom. Only the moved item changes,
 * unless neighbouring positions are equal (e.g. after admin edits), then all are renumbered.
 */
export const moveChecklistItem = (
  items: readonly ChecklistItem[],
  id: ID,
  { beforeId, afterId }: { beforeId?: ID | null; afterId?: ID | null },
): ChecklistItem[] => {
  const item = requireItem(items, id)
  if (beforeId === id || afterId === id) {
    throw new ValidationError('An item cannot be positioned relative to itself')
  }
  const others = sortChecklist(items.filter((i) => i.id !== id))
  const before = beforeId ? requireItem(others, beforeId) : null
  const after = afterId ? requireItem(others, afterId) : null
  if (before && after && others.indexOf(after) !== others.indexOf(before) + 1) {
    throw new ValidationError('beforeId and afterId must be adjacent')
  }

  // Index the item lands at among the others.
  const index = before ? others.indexOf(before) + 1 : after ? others.indexOf(after) : others.length
  const above = others[index - 1]
  const below = others[index]
  const position = positionBetween(above?.position, below?.position)

  const fits = (!above || position > above.position) && (!below || position < below.position)
  if (fits) return sortChecklist([...others, { ...item, position }])
  return renumber([...others.slice(0, index), item, ...others.slice(index)])
}

/** The next occurrence of a repeating task starts with every item unchecked. */
export const resetChecklist = (items: readonly ChecklistItem[], ids: readonly ID[]): ChecklistItem[] =>
  sortChecklist(items).map((item, index) => ({ ...item, id: ids[index], done: false }))
