import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "tasks_checklist" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"done" boolean DEFAULT false,
  	"text" varchar NOT NULL,
  	"position" numeric DEFAULT 0 NOT NULL
  );
  
  ALTER TABLE "tasks_checklist" ADD CONSTRAINT "tasks_checklist_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tasks_checklist_order_idx" ON "tasks_checklist" USING btree ("_order");
  CREATE INDEX "tasks_checklist_parent_id_idx" ON "tasks_checklist" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "tasks_checklist" CASCADE;`)
}
