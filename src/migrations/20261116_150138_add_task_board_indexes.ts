import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE INDEX "project_status_position_idx" ON "tasks" USING btree ("project_id","status","position");
  CREATE INDEX "project_status_completedAt_idx" ON "tasks" USING btree ("project_id","status","completed_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "project_status_position_idx";
  DROP INDEX "project_status_completedAt_idx";`)
}
