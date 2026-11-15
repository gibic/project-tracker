import { ValidationError } from '../shared/errors'

/*
 * Global search across projects, tasks and notes. Matching is "every term is a word prefix":
 * typing `lau pla` finds "Launch plan". Persistence decides how words are stemmed and ranked.
 */

export const SEARCH_KINDS = ['project', 'task', 'note'] as const
export type SearchKind = (typeof SEARCH_KINDS)[number]

export const MAX_SEARCH_QUERY = 200
export const MAX_SEARCH_TERMS = 8
export const DEFAULT_SEARCH_LIMIT = 10
export const MAX_SEARCH_LIMIT = 50

/**
 * Splits a free-text query into lowercase word terms (letters and digits only, unique, in order).
 * Punctuation never reaches the search backend, so a query cannot inject query syntax.
 */
export const parseSearchTerms = (query: string): string[] => {
  const words = query.slice(0, MAX_SEARCH_QUERY).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  return [...new Set(words)].slice(0, MAX_SEARCH_TERMS)
}

export const parseSearchKinds = (value: unknown): SearchKind[] => {
  if (value === undefined || value === null) return [...SEARCH_KINDS]
  if (!Array.isArray(value)) throw new ValidationError('kinds must be a list', 'kinds')
  const kinds = SEARCH_KINDS.filter((kind) => value.includes(kind))
  const unknown = value.find((v) => !SEARCH_KINDS.includes(v as SearchKind))
  if (unknown !== undefined) throw new ValidationError(`Unknown search kind "${String(unknown)}"`, 'kinds')
  return kinds.length ? kinds : [...SEARCH_KINDS]
}

export const parseSearchLimit = (value: unknown): number => {
  if (value === undefined || value === null || value === '') return DEFAULT_SEARCH_LIMIT
  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
    throw new ValidationError(`limit must be a whole number from 1 to ${MAX_SEARCH_LIMIT}`, 'limit')
  }
  return limit
}

/** True when every term is a prefix of some word in `text`. Reference semantics for adapters and tests. */
export const matchesSearchTerms = (text: string, terms: string[]): boolean => {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  return terms.length > 0 && terms.every((term) => words.some((word) => word.startsWith(term)))
}
