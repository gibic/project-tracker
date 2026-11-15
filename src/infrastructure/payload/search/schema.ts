import type { PostgresAdapterArgs } from '@payloadcms/db-postgres'

import { sql } from '@payloadcms/db-postgres/drizzle'
import { customType, index } from '@payloadcms/db-postgres/drizzle/pg-core'

type PostgresSchemaHook = NonNullable<PostgresAdapterArgs['afterSchemaInit']>[number]

/*
 * Full-text search columns. Payload has no tsvector field, so each searchable table gets a
 * generated `search_vector` column plus a GIN index through Drizzle. Declaring them here (not
 * only in a migration) keeps dev `push` mode from dropping them. Titles weigh A, text B.
 */

export const SEARCH_CONFIG = 'english'

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' })

/** Source columns per table. Raw column names; all are nullable text. */
export const SEARCH_SOURCES = {
  projects: { title: 'name', text: 'description' },
  tasks: { title: 'title', text: 'description' },
  notes: { title: 'title', text: 'search_text' },
} as const

const vectorExpression = ({ title, text }: { title: string; text: string }) =>
  sql.raw(
    `setweight(to_tsvector('${SEARCH_CONFIG}', coalesce("${title}", '')), 'A') || ` +
      `setweight(to_tsvector('${SEARCH_CONFIG}', coalesce("${text}", '')), 'B')`,
  )

export const searchSchemaHook: PostgresSchemaHook = ({ extendTable, schema }) => {
  for (const [table, source] of Object.entries(SEARCH_SOURCES)) {
    extendTable({
      table: schema.tables[table],
      columns: { searchVector: tsvector('search_vector').generatedAlwaysAs(vectorExpression(source)) },
      extraConfig: (t) => ({ [`${table}_search_idx`]: index(`${table}_search_idx`).using('gin', t.searchVector) }),
    })
  }
  return schema
}
