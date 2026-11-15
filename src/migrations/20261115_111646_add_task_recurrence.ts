import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tasks_recurrence" AS ENUM('daily', 'weekdays', 'weekly', 'monthly', 'yearly');
  ALTER TABLE "tasks" ADD COLUMN "recurrence" "enum_tasks_recurrence";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tasks" DROP COLUMN "recurrence";
  DROP TYPE "public"."enum_tasks_recurrence";`)
}
