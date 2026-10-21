import type { ID } from '../shared/types'

import { ValidationError } from '../shared/errors'
import { optionalText, requireText } from '../shared/validation'

export interface Note {
  id: ID
  title: string
  /** Markdown source. Persistence may store it in another format. */
  body: string
  tags: string[]
  projectIds: ID[]
  taskIds: ID[]
  /**
   * Keys (see `titleKey`) of notes referenced from the body with `[[Title]]`.
   * Derived from the body on save. Kept as keys, not ids, so a link resolves
   * as soon as a note with that title exists.
   */
  linkKeys: string[]
  createdAt: Date
  updatedAt: Date
}

export type NoteSummary = Omit<Note, 'body'>

export interface NoteInput {
  title: string
  body: string
  tags: string[]
  projectIds: ID[]
  taskIds: ID[]
}

export const MAX_TAGS = 20

/** Tags are lowercase kebab-case, unique, and order-preserving. */
export const normalizeTags = (raw: string[] | string): string[] => {
  const parts = Array.isArray(raw) ? raw : raw.split(',')
  const tags: string[] = []
  for (const part of parts) {
    const tag = part
      .trim()
      .toLowerCase()
      .replace(/^#/, '')
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    if (tag && !tags.includes(tag)) tags.push(tag)
  }
  if (tags.length > MAX_TAGS) throw new ValidationError(`A note can have at most ${MAX_TAGS} tags`, 'tags')
  return tags
}

const uniqueIds = (ids: unknown): ID[] =>
  Array.isArray(ids) ? [...new Set(ids.map(String).filter(Boolean))] : []

export const validateNoteInput = (input: Partial<Record<keyof NoteInput, unknown>>): NoteInput => ({
  title: requireText(input.title, 'title', { max: 200 }),
  body: optionalText(input.body, 'body', 100_000),
  tags: normalizeTags(
    Array.isArray(input.tags) ? input.tags.map(String) : typeof input.tags === 'string' ? input.tags : [],
  ),
  projectIds: uniqueIds(input.projectIds),
  taskIds: uniqueIds(input.taskIds),
})

const WIKI_LINK = /\[\[([^\[\]\n]+?)\]\]/g

/** Titles referenced with `[[Title]]`, trimmed and de-duplicated case-insensitively. */
export const extractWikiLinks = (body: string): string[] => {
  const seen = new Set<string>()
  const titles: string[] = []
  for (const match of body.matchAll(WIKI_LINK)) {
    const title = match[1].trim()
    const key = titleKey(title)
    if (title && !seen.has(key)) {
      seen.add(key)
      titles.push(title)
    }
  }
  return titles
}

/** Case-insensitive identity of a title. Titles are unique per user by this key. */
export const titleKey = (title: string): string => title.trim().replace(/\s+/g, ' ').toLowerCase()

export const deriveLinkKeys = (body: string): string[] => extractWikiLinks(body).map(titleKey)
