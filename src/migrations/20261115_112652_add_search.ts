import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { lexicalToMarkdown, type LexicalState } from '../infrastructure/payload/richText'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("name", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '')), 'B')) STORED;
  ALTER TABLE "tasks" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '')), 'B')) STORED;
  ALTER TABLE "notes" ADD COLUMN "search_text" varchar;
  ALTER TABLE "notes" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce("search_text", '')), 'B')) STORED;
  CREATE INDEX "projects_search_idx" ON "projects" USING gin ("search_vector");
  CREATE INDEX "tasks_search_idx" ON "tasks" USING gin ("search_vector");
  CREATE INDEX "notes_search_idx" ON "notes" USING gin ("search_vector");`)

  // Backfill the markdown copy of existing notes; new saves derive it in the Notes collection hook.
  const { rows } = await db.execute<{ id: number; content: LexicalState }>(
    sql`SELECT "id", "content" FROM "notes" WHERE "content" IS NOT NULL`,
  )
  for (const row of rows) {
    const markdown = await lexicalToMarkdown(payload.config, row.content)
    await db.execute(sql`UPDATE "notes" SET "search_text" = ${markdown} WHERE "id" = ${row.id}`)
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "projects_search_idx";
  DROP INDEX "tasks_search_idx";
  DROP INDEX "notes_search_idx";
  ALTER TABLE "projects" DROP COLUMN "search_vector";
  ALTER TABLE "tasks" DROP COLUMN "search_vector";
  ALTER TABLE "notes" DROP COLUMN "search_vector";
  ALTER TABLE "notes" DROP COLUMN "search_text";`)
}
