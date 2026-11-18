import { postgresAdapter, type PostgresAdapter } from '@payloadcms/db-postgres'
import { attachDatabasePool } from '@vercel/functions'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Notes } from './infrastructure/payload/collections/Notes'
import { OAuthClients } from './infrastructure/payload/collections/OAuthClients'
import { OAuthGrants } from './infrastructure/payload/collections/OAuthGrants'
import { Projects } from './infrastructure/payload/collections/Projects'
import { Tasks } from './infrastructure/payload/collections/Tasks'
import { Users } from './infrastructure/payload/collections/Users'
import { defaultLexical } from './infrastructure/payload/editor'
import { searchSchemaHook } from './infrastructure/payload/search/schema'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
  },
  editor: defaultLexical,
  db: postgresAdapter({
    // No `prodMigrations`: migrations run once per deployment in scripts/vercel-build.mjs.
    afterSchemaInit: [searchSchemaHook],
    pool: {
      // On Vercel this must be Neon's pooled (`-pooler`) URL: every function instance keeps its own pool.
      connectionString: process.env.DATABASE_URL || '',
      // Payload keeps one client checked out for the pool's lifetime, so usable slots are max - 1. Keep max >= 3.
      max: Number(process.env.DATABASE_POOL_MAX) || 5,
      idleTimeoutMillis: 5_000,
      // Fail fast when the pool is exhausted instead of hanging until the function times out.
      connectionTimeoutMillis: 10_000,
    },
  }),
  // Fluid compute suspends idle instances; this keeps them alive just long enough to close idle connections.
  // It only acts inside the Vercel runtime, so local dev, the CLI and tests are unaffected.
  onInit: (payload) => {
    if (process.env.VERCEL) attachDatabasePool((payload.db as unknown as PostgresAdapter).pool)
  },
  collections: [Projects, Tasks, Notes, Users, OAuthClients, OAuthGrants],
  cors: [getServerSideURL()].filter(Boolean),
  secret: process.env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
