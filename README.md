# Workspace

A personal knowledge base and multi-project task tracker, built on [Payload](https://payloadcms.com) 3, Next.js 16 (App Router), React 19, Tailwind 4, Postgres, and [zustand](https://zustand.docs.pmnd.rs).

The workspace UI (`/`) and the Payload admin panel (`/admin`) run in the same Next.js app and share one login.

## Features

- **Projects**: create, edit, color-code, archive (archived projects are read-only until restored), and delete (also removes the project's tasks; linked notes are kept and unlinked). Each project shows a progress bar of finished tasks.
- **Tasks**: kanban board (todo, in progress, done) with drag and drop between and within columns, or a list view sorted by urgency. Quick add, priority, due date, overdue and due-soon highlighting, filters by text and priority, and an edit dialog. Finishing a task records its completion date.
- **Checklists**: each task can hold up to 100 subtasks. Add, check off, edit, reorder by dragging, and delete items; cards show checklist progress.
- **Recurring tasks**: a task can repeat every day, weekday, week, month, or year. Completing it creates the next occurrence in the todo column with the next due date and an unchecked checklist. A late completion schedules the next occurrence in the future, and month ends do not drift (Jan 31, Feb 28, Mar 31).
- **Notes**: markdown editing with preview, tags, title search with filter chips, `[[Note title]]` links between notes, and backlinks. Notes render headings, lists, checklists, quotes, links, tables, and fenced code blocks. Notes can be linked to projects and tasks. In the admin panel the same notes open in a rich-text (Lexical) editor.
- **Global search**: press ⌘K (Ctrl+K) to open a command palette that searches projects, tasks, and notes by title, description, and note body. Every word is a prefix match, so `lau pla` finds "Launch plan". Picking a task opens it on its project board (`/projects/:id?task=:taskId`). The palette can also create projects, tasks, and notes from what you typed.
- **Dashboard**: overdue tasks, tasks due in the next 7 days, tasks in progress, project progress, recent notes, and totals.
- **AI agents (MCP)**: an [MCP](https://modelcontextprotocol.io) server at `/mcp` lets Claude, ChatGPT, and other agents read and change your projects, tasks, checklists, and notes. Agents go through the same business rules as the workspace UI. See [Connecting AI agents](#connecting-ai-agents-mcp).
- **Private by default**: every record has an owner, and all reads and writes run as the logged-in user with access control enforced.

## Quick start

Requirements: Node.js 20.18+, pnpm, and Docker (or any Postgres 17 server).

```bash
cp .env.example .env              # then set DATABASE_URL, POSTGRES_PASSWORD, PAYLOAD_SECRET
docker-compose up postgres        # start only the database
pnpm install
pnpm dev                          # http://localhost:3000
```

1. Open `http://localhost:3000/admin/create-first-user` and create your account.
2. Sign in at `http://localhost:3000/login`.

To run the app in Docker as well, use `docker-compose up` instead. The app container talks to the database through the `postgres` host.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `POSTGRES_PASSWORD` | Password for the docker-compose Postgres service; must match `DATABASE_URL` |
| `PAYLOAD_SECRET` | Secret used to sign auth tokens |
| `NEXT_PUBLIC_SERVER_URL` | Public URL of the app, without a trailing slash |
| `CRON_SECRET` | Bearer token for running Payload jobs from a cron service |

## Architecture

The code is split into layers. Dependencies only point inward, and ESLint (`eslint.config.mjs`) fails the lint when a file imports across a boundary it should not.

New to the code? [docs/understanding-the-codebase.md](docs/understanding-the-codebase.md) is a beginner walkthrough of the layers, a reading order, and one feature traced end to end.

```
src/
  domain/            Business rules. Entities, validation, task ordering, due-date and
                     recurrence logic, checklists, tag normalization, wiki-link parsing,
                     search query parsing, OAuth token rules. Plain TypeScript, no frameworks.
  application/       Use cases (createTask, moveTask, getNote, getDashboard, search, ...) and
                     the ports they depend on (repository and service interfaces).
  infrastructure/    Adapters. Payload collections, access control, Lexical editor config,
                     Payload-backed repositories, full-text search SQL, auth session helpers.
                     container.ts is the composition root that builds the use-case context.
  features/          Presentation. Server actions, client components, zustand stores,
                     the command palette, the MCP server, and the OAuth endpoints.
  app/(frontend)/    Presentation. Routes: login, dashboard, projects, notes, search, OAuth consent.
  app/(mcp)/         Presentation. MCP endpoint, OAuth token/registration, discovery metadata.
  app/(payload)/     Payload admin panel and REST/GraphQL API (generated).
```

| Layer | May import |
| --- | --- |
| Domain | nothing outside `src/domain` |
| Application | domain |
| Infrastructure | application ports, domain, Payload |
| Presentation | application, domain, and from infrastructure only `container` and `auth/session` |

### Request flow

1. A server component calls `getAppContext()`. This checks the session and builds an `AppContext` whose repositories are scoped to the current user.
2. The page calls a use case, for example `getProjectBoard(ctx, id)`, and renders the result.
3. Mutations go through server actions in `src/features/*/actions.ts`. Each action wraps a use case in `runAction`, which turns business-rule errors into a message for the UI, then revalidates the page.

### State with zustand

- `src/features/tasks/boardStore.ts`: one store per project board, created in `BoardStoreProvider` from server data. It holds tasks, filters, drag-and-drop state, and the open task. A move updates the board immediately, then calls the server; if the server rejects it, the board rolls back.
- `src/features/shell/uiStore.ts`: a global store for UI preferences (board or list view), saved to `localStorage` and loaded after the page renders.

### Notes storage

Notes are stored as Lexical JSON, so the admin panel shows a full rich-text editor. The domain and the workspace UI work with markdown; `src/infrastructure/payload/richText.ts` converts between the two and renders HTML. Editor features are limited to what survives the markdown round trip (headings, bold, italic, strikethrough, inline code, links, lists, checklists, quotes, horizontal rules).

`[[Title]]` links are saved as normalized title keys, so a link starts working as soon as a note with that title exists. Note titles are unique per user, ignoring case.

### Search

Projects, tasks, and notes have a generated Postgres `search_vector` column (`tsvector`) with a GIN index, declared in `src/infrastructure/payload/search/schema.ts`. Because the columns are added through Payload's `afterSchemaInit` hook, dev `push` mode keeps them. Note bodies are indexed from a hidden `searchText` field that a field hook derives from the note content, so edits made in the admin panel are indexed too.

The search use case runs the query, then reads every hit again through the access-controlled repositories. The command palette calls `GET /search` with the session cookie; agents use the MCP `search` tool.

### Admin panel

`/admin` gives raw access to projects, tasks, notes, and users. Edits made there skip the application-layer rules (for example the completion date on tasks, note link keys, and read-only archived projects), so prefer the workspace UI for everyday use.

## Connecting AI agents (MCP)

The app runs a stateless MCP server (Streamable HTTP) at `/mcp`. Every tool calls an application use case, so agents get the same rules as the workspace UI: owner scoping, read-only archived projects, completion dates, recurrence, unique note titles, and wiki-link keys.

Tools:

| Area | Tools |
| --- | --- |
| Overview | `get_dashboard`, `search` |
| Projects | `list_projects`, `get_project`, `create_project`, `update_project`, `set_project_archived`, `delete_project` |
| Tasks | `create_task`, `update_task`, `move_task`, `delete_task` |
| Checklists | `add_checklist_item`, `update_checklist_item`, `move_checklist_item`, `delete_checklist_item` |
| Notes | `list_notes`, `list_tags`, `get_note`, `create_note`, `update_note`, `delete_note` |

The endpoint accepts `Authorization: Bearer <token>`, where the token is one of these:

- **An OAuth access token**, for connectors such as claude.ai and ChatGPT. Add `https://<your-domain>/mcp` as a custom connector. The client discovers the authorization server through `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`, registers itself at `/oauth/register`, and sends you to `/oauth/authorize`. There you sign in and approve access. The client then gets tokens from `/oauth/token`. PKCE (S256) is required. Access tokens last 1 hour and refresh tokens 30 days; refresh tokens rotate on every use.
- **A Payload user API key**, for Claude Code and scripts. In `/admin`, open your user, enable the API key, and copy it. Then add the server:

  ```bash
  claude mcp add --transport http project-tracker https://<your-domain>/mcp \
    --header "Authorization: Bearer <api-key>"
  ```

Tokens are stored only as SHA-256 hashes in the `oauth-grants` collection. To revoke a connector, delete its grant (or its entry in `oauth-clients`) in the admin panel. To revoke an API key, disable or regenerate it on your user.

## Development

```bash
pnpm dev                    # dev server
pnpm lint                   # ESLint, including layer boundaries
pnpm typecheck              # tsc --noEmit
pnpm generate:types         # regenerate src/payload-types.ts after changing a collection
pnpm generate:importmap     # regenerate the admin import map after changing admin components or editor features
```

In development, the Postgres adapter runs in `push` mode: the database schema follows the Payload config automatically, without migrations. Never point `DATABASE_URL` at a production database while running `pnpm dev`.

### Tests

```bash
pnpm test:unit              # domain and use cases with in-memory repositories; no database
pnpm test:int               # use cases through the real Payload repositories and Postgres
pnpm test:e2e               # Playwright: login, projects, drag and drop, command palette, notes
pnpm test                   # all of the above
```

Integration and end-to-end tests write to the database in `DATABASE_URL`. Point them at a disposable database:

```bash
DATABASE_URL=postgres://postgres:<password>@127.0.0.1:5432/learnpayload_test pnpm test:int
```

`pnpm test:e2e` starts `pnpm dev` on port 3000, or reuses a server that is already running. Set `E2E_BASE_URL` to test a server on another URL. Run `npx playwright install chromium` once before the first run.

## Production

```bash
pnpm payload migrate:create   # locally, after schema changes; commit the generated migration
pnpm build
pnpm payload migrate          # on the server, before starting
pnpm start
```

The app deploys like any other Next.js application (VPS, Docker, Coolify, and similar). See the [Payload deployment docs](https://payloadcms.com/docs/production/deployment).

On Vercel, set `DATABASE_URL` to Neon's pooled connection string (the host contains `-pooler`; the Neon integration sets it by default). Every function instance keeps its own small pool (5 connections, `DATABASE_POOL_MAX`), and `attachDatabasePool` from `@vercel/functions` closes idle connections before Fluid compute suspends an instance.
