import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_oauth_clients_token_endpoint_auth_method" AS ENUM('none', 'client_secret_post', 'client_secret_basic');
  CREATE TABLE "oauth_clients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"client_id" varchar NOT NULL,
  	"redirect_uris" jsonb NOT NULL,
  	"token_endpoint_auth_method" "enum_oauth_clients_token_endpoint_auth_method" NOT NULL,
  	"secret_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "oauth_grants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_id" integer NOT NULL,
  	"redirect_uri" varchar NOT NULL,
  	"code_challenge" varchar NOT NULL,
  	"code_hash" varchar,
  	"code_expires_at" timestamp(3) with time zone,
  	"access_token_hash" varchar,
  	"access_token_expires_at" timestamp(3) with time zone,
  	"refresh_token_hash" varchar,
  	"refresh_token_expires_at" timestamp(3) with time zone,
  	"owner_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "oauth_clients_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "oauth_grants_id" integer;
  ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "oauth_clients_client_id_idx" ON "oauth_clients" USING btree ("client_id");
  CREATE INDEX "oauth_clients_updated_at_idx" ON "oauth_clients" USING btree ("updated_at");
  CREATE INDEX "oauth_clients_created_at_idx" ON "oauth_clients" USING btree ("created_at");
  CREATE INDEX "oauth_grants_client_idx" ON "oauth_grants" USING btree ("client_id");
  CREATE UNIQUE INDEX "oauth_grants_code_hash_idx" ON "oauth_grants" USING btree ("code_hash");
  CREATE UNIQUE INDEX "oauth_grants_access_token_hash_idx" ON "oauth_grants" USING btree ("access_token_hash");
  CREATE UNIQUE INDEX "oauth_grants_refresh_token_hash_idx" ON "oauth_grants" USING btree ("refresh_token_hash");
  CREATE INDEX "oauth_grants_owner_idx" ON "oauth_grants" USING btree ("owner_id");
  CREATE INDEX "oauth_grants_updated_at_idx" ON "oauth_grants" USING btree ("updated_at");
  CREATE INDEX "oauth_grants_created_at_idx" ON "oauth_grants" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_clients_fk" FOREIGN KEY ("oauth_clients_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_grants_fk" FOREIGN KEY ("oauth_grants_id") REFERENCES "public"."oauth_grants"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_oauth_clients_id_idx" ON "payload_locked_documents_rels" USING btree ("oauth_clients_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_grants_id_idx" ON "payload_locked_documents_rels" USING btree ("oauth_grants_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "oauth_clients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "oauth_grants" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "oauth_clients" CASCADE;
  DROP TABLE "oauth_grants" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_clients_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_grants_fk";
  
  DROP INDEX "payload_locked_documents_rels_oauth_clients_id_idx";
  DROP INDEX "payload_locked_documents_rels_oauth_grants_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "oauth_clients_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "oauth_grants_id";
  DROP TYPE "public"."enum_oauth_clients_token_endpoint_auth_method";`)
}
