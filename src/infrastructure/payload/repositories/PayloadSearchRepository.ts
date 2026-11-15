import type { PostgresAdapter } from '@payloadcms/db-postgres'

import type { SearchHit, SearchRepository } from '@/application/ports/repositories'
import type { SearchKind } from '@/domain/search/search'

import { sql } from '@payloadcms/db-postgres'
import { SEARCH_CONFIG, SEARCH_SOURCES } from '../search/schema'
import { fromDbId, type RepositoryScope } from './shared'

/*
 * Postgres full-text search on the generated `search_vector` columns. Raw SQL cannot go through
 * Payload access control, so every query filters on `owner_id` itself, and the search use case
 * re-reads hits through the access-controlled repositories before returning them.
 */

const TABLES: Record<SearchKind, keyof typeof SEARCH_SOURCES> = { project: 'projects', task: 'tasks', note: 'notes' }

const HEADLINE_OPTIONS = 'StartSel="", StopSel="", MaxWords=24, MinWords=8, ShortWord=2'

/** `['lau', 'pla']` -> `lau:* & pla:*`. Terms are letters/digits only (`parseSearchTerms`). */
export const toPrefixTsQuery = (terms: string[]): string => terms.map((term) => `${term}:*`).join(' & ')

/** Flattens a headline from markdown into one plain line. */
export const plainSnippet = (text: string): string =>
  text
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)(#{1,6}|>|[-*+]|\d+\.)\s/g, '$1')
    .replace(/[*`|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

interface HitRow extends Record<string, unknown> {
  id: number
  rank: number
  snippet: string | null
}

export const createPayloadSearchRepository = ({ payload, user }: RepositoryScope): SearchRepository => {
  const db = (payload.db as unknown as PostgresAdapter).drizzle
  const config = sql.raw(`'${SEARCH_CONFIG}'::regconfig`)

  const searchKind = async (kind: SearchKind, query: string, limit: number): Promise<SearchHit[]> => {
    const table = TABLES[kind]
    const text = sql.raw(`coalesce("${SEARCH_SOURCES[table].text}", '')`)
    // Inner query ranks and limits; the outer one builds headlines (costly) for the top rows only.
    const { rows } = await db.execute<HitRow>(sql`
      SELECT hits.id, hits.rank, ts_headline(${config}, hits.text, hits.q, ${HEADLINE_OPTIONS}) AS snippet
      FROM (
        SELECT t.id, ts_rank_cd(t.search_vector, q, 1) AS rank, ${text} AS text, q, t.updated_at
        FROM ${sql.identifier(table)} t, to_tsquery(${config}, ${query}) q
        WHERE t.owner_id = ${user.id} AND t.search_vector @@ q
        ORDER BY rank DESC, t.updated_at DESC
        LIMIT ${limit}
      ) hits
      ORDER BY hits.rank DESC, hits.updated_at DESC
    `)
    return rows.map((row) => ({
      kind,
      id: fromDbId(row.id),
      rank: Number(row.rank),
      snippet: plainSnippet(row.snippet ?? ''),
    }))
  }

  return {
    async search({ terms, kinds, limit }) {
      if (terms.length === 0) return []
      const query = toPrefixTsQuery(terms)
      const results = await Promise.all(kinds.map((kind) => searchKind(kind, query, limit)))
      return results.flat()
    },
  }
}
