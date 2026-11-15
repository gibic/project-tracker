import { describe, expect, it } from 'vitest'

import { deriveLinkKeys, extractWikiLinks, normalizeTags, validateNoteInput } from '@/domain/notes/note'
import { validateProjectInput } from '@/domain/projects/project'
import { matchesSearchTerms, parseSearchKinds, parseSearchLimit, parseSearchTerms } from '@/domain/search/search'
import { NotFoundError, ValidationError } from '@/domain/shared/errors'
import {
  addChecklistItem,
  CHECKLIST_MAX_ITEMS,
  checklistProgress,
  moveChecklistItem,
  parseChecklistItemId,
  parseChecklistTexts,
  removeChecklistItem,
  resetChecklist,
  updateChecklistItem,
  type ChecklistItem,
} from '@/domain/tasks/checklist'
import { computeProgress } from '@/domain/tasks/progress'
import { nextDueDate, parseRecurrence } from '@/domain/tasks/recurrence'
import {
  applyStatusChange,
  compareByUrgency,
  isDueSoon,
  isOverdue,
  positionBetween,
  validateTaskInput,
  type Task,
} from '@/domain/tasks/task'

const now = new Date('2026-10-21T09:00:00.000Z')

const task = (overrides: Partial<Task> = {}): Task => ({
  id: '1',
  projectId: 'p',
  title: 'Task',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  recurrence: null,
  checklist: [],
  position: 1024,
  completedAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
})

describe('projects', () => {
  it('trims and defaults input', () => {
    expect(validateProjectInput({ name: '  Website  ' })).toEqual({ name: 'Website', description: '', color: 'slate' })
  })

  it('rejects empty names and unknown colors', () => {
    expect(() => validateProjectInput({ name: '   ' })).toThrow(ValidationError)
    expect(() => validateProjectInput({ name: 'x', color: 'neon' })).toThrow(/color/)
  })
})

describe('tasks', () => {
  it('pins date-only due dates to noon UTC', () => {
    expect(validateTaskInput({ title: 'x', dueDate: '2026-10-25' }).dueDate?.toISOString()).toBe(
      '2026-10-25T12:00:00.000Z',
    )
    expect(validateTaskInput({ title: 'x', dueDate: '' }).dueDate).toBeNull()
    expect(() => validateTaskInput({ title: 'x', dueDate: 'soon' })).toThrow(/dueDate/)
  })

  it('sets completedAt when entering done and clears it when leaving', () => {
    const done = applyStatusChange(task(), 'done', now)
    expect(done).toEqual({ status: 'done', completedAt: now })
    expect(applyStatusChange(task(done), 'todo', now)).toEqual({ status: 'todo', completedAt: null })
    // Staying in done keeps the original completion time.
    const earlier = new Date('2026-01-01')
    expect(applyStatusChange(task({ status: 'done', completedAt: earlier }), 'done', now).completedAt).toBe(earlier)
  })

  it('computes positions between neighbours', () => {
    expect(positionBetween(null, null)).toBe(1024)
    expect(positionBetween(1024, null)).toBe(2048)
    expect(positionBetween(null, 1024)).toBe(0)
    expect(positionBetween(1024, 2048)).toBe(1536)
  })

  it('classifies overdue and due-soon tasks by calendar day', () => {
    const yesterday = new Date('2026-10-20T12:00:00.000Z')
    const inThreeDays = new Date('2026-10-24T12:00:00.000Z')
    const inTwoWeeks = new Date('2026-11-04T12:00:00.000Z')
    expect(isOverdue(task({ dueDate: yesterday }), now)).toBe(true)
    expect(isOverdue(task({ dueDate: yesterday, status: 'done' }), now)).toBe(false)
    expect(isDueSoon(task({ dueDate: inThreeDays }), now)).toBe(true)
    expect(isDueSoon(task({ dueDate: inTwoWeeks }), now)).toBe(false)
    expect(isDueSoon(task({ dueDate: yesterday }), now)).toBe(false)
  })

  it('sorts by priority, then due date', () => {
    const sorted = [
      task({ id: 'low', priority: 'low' }),
      task({ id: 'urgent-late', priority: 'urgent', dueDate: new Date('2026-12-01') }),
      task({ id: 'urgent-soon', priority: 'urgent', dueDate: new Date('2026-10-22') }),
    ].sort(compareByUrgency)
    expect(sorted.map((t) => t.id)).toEqual(['urgent-soon', 'urgent-late', 'low'])
  })

  it('computes progress', () => {
    expect(computeProgress([])).toMatchObject({ total: 0, percent: 0 })
    const progress = computeProgress([task({ status: 'done' }), task(), task({ status: 'in_progress' })])
    expect(progress).toMatchObject({ total: 3, done: 1, percent: 33, byStatus: { todo: 1, in_progress: 1, done: 1 } })
  })
})

describe('recurrence', () => {
  // `now` is Wednesday 2026-10-21.
  const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`)
  const next = (...args: Parameters<typeof nextDueDate>) => nextDueDate(...args).toISOString().slice(0, 10)

  it('parses empty values as no recurrence and rejects unknown ones', () => {
    expect(parseRecurrence(undefined)).toBeNull()
    expect(parseRecurrence('')).toBeNull()
    expect(parseRecurrence('none')).toBeNull()
    expect(parseRecurrence('weekly')).toBe('weekly')
    expect(() => parseRecurrence('hourly')).toThrow(/recurrence/)
    expect(validateTaskInput({ title: 'x' }).recurrence).toBeNull()
  })

  it('advances from the due date', () => {
    expect(next('daily', day('2026-10-25'), now)).toBe('2026-10-26')
    expect(next('weekly', day('2026-10-25'), now)).toBe('2026-11-01')
    expect(next('monthly', day('2026-10-25'), now)).toBe('2026-11-25')
    expect(next('yearly', day('2026-10-25'), now)).toBe('2027-10-25')
  })

  it('counts from today without a due date', () => {
    expect(next('daily', null, now)).toBe('2026-10-22')
    expect(next('weekly', null, now)).toBe('2026-10-28')
  })

  it('skips occurrences that are today or past when completed late', () => {
    expect(next('daily', day('2026-10-01'), now)).toBe('2026-10-22')
    expect(next('weekly', day('2026-10-07'), now)).toBe('2026-10-28')
    expect(next('monthly', day('2026-10-21'), now)).toBe('2026-11-21')
  })

  it('skips weekends for weekdays', () => {
    expect(next('weekdays', day('2026-10-23'), now)).toBe('2026-10-26') // Friday to Monday
    expect(next('weekdays', day('2026-10-14'), now)).toBe('2026-10-22')
  })

  it('clamps month ends without drifting', () => {
    expect(next('monthly', day('2027-01-31'), now)).toBe('2027-02-28')
    expect(next('monthly', day('2026-08-31'), now)).toBe('2026-10-31')
    expect(next('yearly', day('2028-02-29'), now)).toBe('2029-02-28')
  })
})

describe('notes', () => {
  it('normalizes tags', () => {
    expect(normalizeTags(' #Machine Learning, research,RESEARCH, , c++ ')).toEqual(['machine-learning', 'research', 'c'])
  })

  it('caps the number of tags', () => {
    expect(() => normalizeTags(Array.from({ length: 21 }, (_, i) => `t${i}`))).toThrow(/at most 20/)
  })

  it('extracts unique wiki links', () => {
    const body = 'See [[Rust Ownership]] and [[rust  ownership]], also [[ Borrowing ]]. Not [[]] or [single].'
    expect(extractWikiLinks(body)).toEqual(['Rust Ownership', 'Borrowing'])
    expect(deriveLinkKeys(body)).toEqual(['rust ownership', 'borrowing'])
  })

  it('validates input and de-duplicates references', () => {
    expect(validateNoteInput({ title: ' Idea ', tags: 'a, b', projectIds: ['1', '1', 2] })).toEqual({
      title: 'Idea',
      body: '',
      tags: ['a', 'b'],
      projectIds: ['1', '2'],
      taskIds: [],
    })
  })
})

describe('search', () => {
  it('splits queries into unique lowercase word terms without query syntax', () => {
    expect(parseSearchTerms('  Launch-PLAN & launch:* | !draft  ')).toEqual(['launch', 'plan', 'draft'])
    expect(parseSearchTerms('Café über 2026')).toEqual(['café', 'über', '2026'])
    expect(parseSearchTerms('&|!():*')).toEqual([])
    expect(parseSearchTerms('a b c d e f g h i j')).toHaveLength(8)
  })

  it('validates kinds and limit', () => {
    expect(parseSearchKinds(undefined)).toEqual(['project', 'task', 'note'])
    expect(parseSearchKinds(['note', 'project'])).toEqual(['project', 'note'])
    expect(() => parseSearchKinds(['people'])).toThrow(ValidationError)
    expect(parseSearchLimit(undefined)).toBe(10)
    expect(parseSearchLimit('5')).toBe(5)
    expect(() => parseSearchLimit(0)).toThrow(ValidationError)
    expect(() => parseSearchLimit(51)).toThrow(ValidationError)
  })

  it('matches when every term prefixes a word', () => {
    expect(matchesSearchTerms('Launch plan for Q4', ['lau', 'pla'])).toBe(true)
    expect(matchesSearchTerms('Launch plan for Q4', ['aunch'])).toBe(false)
    expect(matchesSearchTerms('Launch plan for Q4', ['lau', 'zzz'])).toBe(false)
    expect(matchesSearchTerms('anything', [])).toBe(false)
  })
})

describe('checklist', () => {
  const item = (id: string, position: number, done = false): ChecklistItem => ({ id, text: id, done, position })
  const ids = (items: ChecklistItem[]) => items.map((i) => i.id)
  const items = [item('a', 1024), item('b', 2048, true), item('c', 3072)]

  it('counts done items', () => {
    expect(checklistProgress(items)).toEqual({ total: 3, done: 1, percent: 33 })
    expect(checklistProgress([])).toEqual({ total: 0, done: 0, percent: 0 })
  })

  it('appends new items unchecked at the bottom', () => {
    const next = addChecklistItem(items, { id: 'd', text: 'Write docs' })
    expect(next.at(-1)).toEqual({ id: 'd', text: 'Write docs', done: false, position: 4096 })
    expect(() => addChecklistItem(next, { id: 'd', text: 'again' })).toThrow(ValidationError)
    const full = Array.from({ length: CHECKLIST_MAX_ITEMS }, (_, i) => item(String(i), i))
    expect(() => addChecklistItem(full, { id: 'x', text: 'x' })).toThrow(/at most/)
  })

  it('moves only the moved item between neighbours', () => {
    const next = moveChecklistItem(items, 'c', { beforeId: 'a', afterId: 'b' })
    expect(ids(next)).toEqual(['a', 'c', 'b'])
    expect(next.find((i) => i.id === 'c')?.position).toBe(1536)
    expect(next.find((i) => i.id === 'a')?.position).toBe(1024)
    expect(ids(moveChecklistItem(items, 'c', { afterId: 'a' }))).toEqual(['c', 'a', 'b'])
    expect(ids(moveChecklistItem(items, 'a', {}))).toEqual(['b', 'c', 'a'])
  })

  it('renumbers when neighbours share a position', () => {
    const tied = [item('a', 0), item('b', 0), item('c', 0)]
    const next = moveChecklistItem(tied, 'c', { beforeId: 'a', afterId: 'b' })
    expect(ids(next)).toEqual(['a', 'c', 'b'])
    expect(next.map((i) => i.position)).toEqual([1024, 2048, 3072])
  })

  it('rejects unknown, self or non-adjacent neighbours', () => {
    expect(() => moveChecklistItem(items, 'a', { beforeId: 'a' })).toThrow(ValidationError)
    expect(() => moveChecklistItem(items, 'a', { beforeId: 'zz' })).toThrow(NotFoundError)
    expect(() => moveChecklistItem(items, 'b', { afterId: 'c', beforeId: 'a' })).not.toThrow()
    expect(() => moveChecklistItem(items, 'a', { beforeId: 'c', afterId: 'b' })).toThrow(/adjacent/)
  })

  it('updates and removes items', () => {
    expect(updateChecklistItem(items, 'a', { done: true })[0]).toMatchObject({ id: 'a', done: true })
    expect(ids(removeChecklistItem(items, 'b'))).toEqual(['a', 'c'])
    expect(() => updateChecklistItem(items, 'zz', { done: true })).toThrow(NotFoundError)
  })

  it('resets items for the next occurrence with fresh ids', () => {
    expect(resetChecklist(items, ['x', 'y', 'z'])).toEqual([
      { id: 'x', text: 'a', done: false, position: 1024 },
      { id: 'y', text: 'b', done: false, position: 2048 },
      { id: 'z', text: 'c', done: false, position: 3072 },
    ])
  })

  it('validates texts and ids', () => {
    expect(parseChecklistTexts([' One ', '', 'Two'])).toEqual(['One', 'Two'])
    expect(parseChecklistTexts(undefined)).toEqual([])
    expect(() => parseChecklistTexts('One')).toThrow(ValidationError)
    expect(() => parseChecklistTexts(['x'.repeat(501)])).toThrow(/at most/)
    expect(parseChecklistItemId('0B6F1E2A-1C2D-4E5F-8A9B-0C1D2E3F4A5B')).toBe('0b6f1e2a-1c2d-4e5f-8a9b-0c1d2e3f4a5b')
    expect(() => parseChecklistItemId('1')).toThrow(ValidationError)
  })
})
