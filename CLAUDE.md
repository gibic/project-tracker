# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Skills

- Payload CMS: start with `.claude/skills/payload/SKILL.md` for a quick reference, then `.claude/skills/payload/reference/` for detailed docs.
- shadcn/ui: `.claude/skills/shadcn/` (project is configured via `components.json`; components live in `src/components/ui`, `cn` helper in `src/utilities/ui.ts`).

## Project

Personal knowledge base + multi-project task tracker. Payload 3.x + Next.js 16 App Router + React 19 + Tailwind 4 + Postgres (`@payloadcms/db-postgres`) + zustand 5. Started from the Payload website template; the template's pages/posts/blocks/plugins were removed. The workspace UI (`/`) and the Payload admin (`/admin`) run in the same Next.js app and share the `payload-token` auth cookie.

Single user in practice, but every document has an `owner` and all reads/writes go through owner-scoped access control.

## Commands

Package manager is pnpm.

```bash
cp .env.example .env            # DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_SERVER_URL, CRON_SECRET
docker-compose up               # Postgres 17 + app on :3000 (or run only `postgres` service and use `pnpm dev`)
pnpm dev                        # http://localhost:3000 (workspace), /admin (Payload admin; create the first user there)
pnpm build && pnpm start
pnpm lint / pnpm lint:fix       # also enforces layer boundaries (see eslint.config.mjs)
pnpm typecheck

pnpm generate:types             # regenerate src/payload-types.ts after any collection/field change
pnpm generate:importmap         # regenerate src/app/(payload)/admin/importMap.js after adding/moving admin components or editor features

pnpm test                       # unit, then int, then e2e
pnpm test:unit                  # vitest project "unit": domain + application with in-memory adapters, no DB
pnpm test:int                   # vitest project "int": real Payload + Postgres from DATABASE_URL
pnpm test:int tests/int/workspace.int.spec.ts -t "isolates"   # single file / single test
pnpm test:e2e                   # playwright, tests/e2e; auto-starts `pnpm dev` on :3000 (reuses running server)

pnpm payload migrate:create     # create Postgres migration (needed for deploys)
pnpm payload migrate            # run pending migrations
```

Notes:
- `test:int` and `test:e2e` write to the database in `DATABASE_URL`, and dev mode pushes the schema. Prefer a throwaway DB, e.g. `DATABASE_URL=postgres://.../learnpayload_test pnpm test:int`. Int test files run serially because parallel schema pushes race.
- `tests/e2e/workspace.e2e.spec.ts` reads `E2E_BASE_URL` (default `http://localhost:3000`). E2E helpers (`tests/helpers/seedUser.ts`) create/delete a `dev@payloadcms.com` user and the documents it owns.
- In dev, the Postgres adapter uses `push` mode (schema auto-synced from config, no migrations). Do not point `DATABASE_URL` at a production DB during dev.
- In docker-compose the app overrides `DATABASE_URL` to use host `postgres`; `.env` must define `POSTGRES_PASSWORD`.

## Architecture

Layered (clean architecture). Dependencies point inward only; `eslint.config.mjs` fails the lint on violations.

```
src/domain/          Business layer. Entities, value types, rules. Pure TS: no Payload, Next, React, zustand.
src/application/     Use cases (functions taking AppContext) + ports (repository/service interfaces).
src/infrastructure/  Adapters: Payload collections, access, owner field, Lexical editor, repositories, auth session.
                     container.ts = composition root (builds AppContext for a user).
src/features/        Presentation: server actions, client components, zustand stores, formatting.
src/app/(frontend)/  Presentation: routes. (workspace)/ needs a session; login/ is public.
src/app/(payload)/   Payload-generated admin + REST/GraphQL API (rarely edited).
```

- **Domain** (`src/domain/{projects,tasks,notes}`): validation (`validate*Input` throw `ValidationError`), task status/`completedAt` rule (`applyStatusChange`), fractional board ordering (`positionBetween`), overdue/due-soon (calendar days; date-only due dates are pinned to 12:00 UTC), tag normalization, `[[wiki link]]` parsing and `titleKey`.
- **Application** (`src/application`): one module per area (`projects`, `tasks`, `notes`, `dashboard`). Use cases enforce cross-entity rules: archived projects are read-only, project delete cascades tasks and detaches notes, note titles are unique per user (case-insensitive), notes may only reference the user's own projects/tasks. They depend only on `AppContext` (`ports/repositories.ts`, `ports/services.ts`).
- **Infrastructure** (`src/infrastructure/payload`): collections `projects`, `tasks`, `notes`, `users`. Every repository call runs with `user` + `overrideAccess: false`, and `ownedByUser` access restricts rows to `owner = user.id`. Notes are stored as Lexical JSON but exposed to the domain as markdown (`richText.ts` converts both ways and renders HTML; editor features are limited to what round-trips through markdown). `[[links]]` are stored as derived `linkKeys` (title keys), so backlinks resolve even when the target note is created later. Postgres ids are numbers; the domain uses string ids (`toDbId`/`fromDbId`).
- **Presentation**: server components call use cases through `getAppContext()` / `loadOrNotFound()` (`src/features/shared/server.ts`). Mutations are server actions (`src/features/*/actions.ts`) wrapped in `runAction`, which returns `ActionResult` (domain errors become messages; Next redirects pass through) and then `revalidatePath('/', 'layout')`. Presentation may import domain types and pure functions, but not Payload types or infrastructure beyond `container` and `auth/session`.
- **zustand**: `features/tasks/boardStore.ts` is a per-board vanilla store created in `BoardStoreProvider` (zustand's Next.js per-request pattern) holding tasks, filters, drag state, and the open task; `useTaskMutations` applies optimistic moves, calls the server action, and rolls back on failure. `features/shell/uiStore.ts` is a global persisted store for UI preferences (board/list view) with `skipHydration`, rehydrated after mount in `Sidebar`. Derive arrays with `useMemo`, not inside selectors (new references from a selector cause render loops).
- **Admin panel caveat**: edits made in `/admin` bypass application-layer rules (e.g. `completedAt`, `linkKeys`, archived projects). Treat it as a raw data editor.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
