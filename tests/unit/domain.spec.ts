import { describe, expect, it } from 'vitest'

import { deriveLinkKeys, extractWikiLinks, normalizeTags, validateNoteInput } from '@/domain/notes/note'
import { validateProjectInput } from '@/domain/projects/project'
import { ValidationError } from '@/domain/shared/errors'
import { computeProgress } from '@/domain/tasks/progress'
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
