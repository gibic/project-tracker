// Vercel runs this instead of `build` (package.json `vercel-build`).
//
// Migrations run here, once per deployment, instead of through Payload's `prodMigrations` on every
// cold start: that ran in every new function instance with no lock (concurrent instances raced on the
// same migration) and in Preview builds too, which could migrate the production database.
//
// - Production: migrate, then build. A failed migration fails the build, so the deployment is not promoted.
// - Preview: build only, unless PREVIEW_MIGRATIONS=true. Set that only when Preview has its own database
//   (for example a Neon branch per preview); never when Preview shares the production DATABASE_URL.
//
// The new code goes live after the migration, so the previous deployment briefly runs against the new
// schema: keep migrations backward compatible (add first, remove in a later deploy).

import { spawnSync } from 'node:child_process'

const run = (args, env = process.env) => {
  const { status } = spawnSync('pnpm', args, { stdio: 'inherit', env })
  if (status !== 0) process.exit(status ?? 1)
}

const environment = process.env.VERCEL_ENV
const migrate = environment === 'production' || (environment === 'preview' && process.env.PREVIEW_MIGRATIONS === 'true')

if (migrate) {
  console.log(`[vercel-build] Running migrations (${environment})`)
  // Neon recommends a direct (unpooled) connection for schema changes; the integration provides it.
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  run(['payload', 'migrate'], { ...process.env, DATABASE_URL: databaseUrl })
} else {
  console.log(`[vercel-build] Skipping migrations (VERCEL_ENV=${environment ?? 'unset'})`)
}

run(['build'])
