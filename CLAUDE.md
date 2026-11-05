# CLAUDE.md

Personal knowledge base + multi-project task tracker. Payload 3.x, Next.js 16 App Router, React 19, Tailwind 4, Postgres (`@payloadcms/db-postgres`), zustand 5. Workspace UI (`/`) and Payload admin (`/admin`) run in one Next.js app and share the `payload-token` cookie. Single user in practice, but every document has an `owner` and all reads/writes are owner-scoped.

shadcn/ui: components in `src/components/ui`, `cn` helper in `src/utilities/ui.ts`.

## Commands (pnpm)

- Setup: `cp .env.example .env`. `docker-compose up` runs Postgres 17 + app on :3000 (or run only the `postgres` service and `pnpm dev`). docker-compose needs `POSTGRES_PASSWORD` in `.env` and overrides the `DATABASE_URL` host to `postgres`.
- `pnpm dev`: workspace on :3000, admin on `/admin` (create the first user there). Dev uses Postgres `push` mode (schema auto-sync, no migrations).
- `pnpm lint` (also enforces layer boundaries), `pnpm typecheck`.
- `pnpm generate:types` after any collection/field change. `pnpm generate:importmap` after adding/moving admin components or editor features.
- `pnpm test:unit` (domain + application, in-memory adapters, no DB), `pnpm test:int` (real Payload + Postgres; single test: `pnpm test:int <file> -t "<name>"`), `pnpm test:e2e` (playwright; starts or reuses `pnpm dev`; reads `E2E_BASE_URL`). `pnpm test` runs all three.
- `pnpm payload migrate:create` / `pnpm payload migrate`: migrations are required for deploys.

Int/e2e tests and dev mode write to `DATABASE_URL`: use a throwaway DB (e.g. `.../learnpayload_test`), never production. Int files run serially (parallel schema pushes race). E2E creates/deletes a `dev@payloadcms.com` user and its documents (`tests/helpers/seedUser.ts`).

## Git workflow

Trunk-based development on `main`. Commit small changes directly to `main`, or use a short-lived branch (merged within a day) when review is needed; no long-lived feature branches. Keep `main` deployable: run `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` before pushing. Hide incomplete features behind a flag instead of holding them on a branch.

## Architecture

Clean architecture; dependencies point inward only. `eslint.config.mjs` fails lint on violations.

- `src/domain/{projects,tasks,notes}`: pure TS (no Payload, Next, React, zustand). `validate*Input` (throws `ValidationError`), `applyStatusChange` (status/`completedAt` rule), `positionBetween` (fractional board order), overdue/due-soon (calendar days; date-only due dates pinned to 12:00 UTC), tag normalization, `[[wiki link]]` parsing, `titleKey`.
- `src/application/{projects,tasks,notes,dashboard}`: use cases taking `AppContext`; ports in `ports/repositories.ts` and `ports/services.ts`. Rules: archived projects are read-only; project delete cascades tasks and detaches notes; note titles are unique per user (case-insensitive); notes may only reference the user's own projects/tasks.
- `src/infrastructure/payload`: collections `projects`, `tasks`, `notes`, `users`. Repositories always pass `user` + `overrideAccess: false`; `ownedByUser` access limits rows to `owner = user.id`. `container.ts` is the composition root. Notes are stored as Lexical JSON and exposed to the domain as markdown (`richText.ts`; editor features limited to what round-trips through markdown). `[[links]]` are stored as derived `linkKeys` so backlinks resolve for notes created later. Postgres ids are numbers, domain ids are strings (`toDbId`/`fromDbId`).
- `src/features/` + `src/app/(frontend)/`: presentation. `(workspace)/` needs a session; `login/` is public. Server components call use cases via `getAppContext()` / `loadOrNotFound()` (`features/shared/server.ts`). Mutations are server actions in `features/*/actions.ts` wrapped in `runAction` (returns `ActionResult`, domain errors become messages, redirects pass through, then `revalidatePath('/', 'layout')`). May import domain types and pure functions; from infrastructure only `container` and `auth/session`, never Payload types.
- `src/app/(mcp)/mcp/route.ts` + `features/mcp/server.ts`: stateless Streamable HTTP MCP server (`@modelcontextprotocol/server` v2) for LLM agents. Auth: Payload user API key as `Authorization: Bearer <key>` (enable in Admin > Users). Tools call use cases only, so domain rules apply (unlike admin edits).
- `src/app/(payload)/`: generated admin + REST/GraphQL API, rarely edited. Admin edits bypass application rules (`completedAt`, `linkKeys`, archived projects); treat it as a raw data editor.

zustand:
- `features/tasks/boardStore.ts`: per-board vanilla store created in `BoardStoreProvider` (tasks, filters, drag state, open task). `useTaskMutations` applies optimistic moves, calls the server action, rolls back on failure.
- `features/shell/uiStore.ts`: global persisted UI preferences (board/list view), `skipHydration`, rehydrated after mount in `Sidebar`.
- Derive arrays with `useMemo`, not inside selectors (new references cause render loops).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
