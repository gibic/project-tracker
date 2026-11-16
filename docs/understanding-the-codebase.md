# Understanding the Codebase

This guide is for beginners. It walks you through the project step by step:

1. Learn the big idea: the code is split into **layers**.
2. Learn the one rule that keeps the layers clean.
3. Read the files in a good order, starting with the simplest.
4. Follow one real feature (dragging a task) through every layer.
5. Try some small exercises.

You don't need to understand everything at once. Read a section, open the files it mentions, and come back.

---

## 1. What does this app do?

It is a personal app with three things:

- **Projects**: groups of work, like "Learn Payload".
- **Tasks**: items inside a project. They have a status (`todo`, `in_progress`, `done`) and show on a board you can drag around.
- **Notes**: markdown notes. A note can link to another note by writing `[[Note Title]]`.

It is built with:

- **Next.js**: the web framework. It shows the pages.
- **React**: builds the UI from components.
- **Payload CMS**: saves data to the database. It also gives you an admin panel at `/admin`.
- **Postgres**: the database.
- **zustand**: a small library that holds data in the browser so the board can update quickly.
- **Tailwind + shadcn/ui**: styling and ready-made UI pieces (buttons, dialogs, ...).

The main app is at `/`. The Payload admin panel is at `/admin`. Both run in the same Next.js app and use the same login.

---

## 2. The big idea: layers

The code is split into four **layers**. Each layer has one job.

| Folder                         | Layer          | Its job                                                    | Simple example                                          |
| ------------------------------ | -------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `src/domain/`                  | Domain         | The rules of the app. Plain TypeScript only.               | "When a task becomes `done`, set `completedAt` to now." |
| `src/application/`             | Application    | The actions a user can do. These are called **use cases**. | "Move a task to another column."                        |
| `src/infrastructure/`          | Infrastructure | Talks to outside tools like Payload and the database.      | "Save this task in Postgres."                           |
| `src/features/` and `src/app/` | Presentation   | Pages, buttons, forms. Everything the user sees.           | The task board.                                         |

Think of a restaurant:

- **Domain** = the recipes. They don't care what kitchen you cook in.
- **Application** = the chef, who follows the recipes to make an order.
- **Infrastructure** = the kitchen tools: stove, fridge, storage.
- **Presentation** = the waiter and the menu, the part the customer sees.

---

## 3. The one rule: dependencies point inward

"Dependency" here just means **an `import`**. If file A has `import ... from 'B'`, then A depends on B.

Picture the layers as circles, one inside the other:

```
        ┌──────────────────────────────────────────┐
        │ app/, features/       infrastructure/    │  outer: uses frameworks (Next, React, Payload)
        │   ┌──────────────────────────────────┐   │
        │   │ application/  (use cases, ports) │   │
        │   │   ┌──────────────────────────┐   │   │
        │   │   │ domain/  (pure rules)    │   │   │  inner: no frameworks at all
        │   │   └──────────────────────────┘   │   │
        │   └──────────────────────────────────┘   │
        └──────────────────────────────────────────┘
```

**The rule:** an outer circle may import from an inner circle. An inner circle may **never** import from an outer circle.

So:

- `domain/` imports nothing from the other layers.
- `application/` imports only from `domain/`.
- `infrastructure/` and `features/` may import from `application/` and `domain/`.

### What each layer may import

| Layer               | Can import                                       | Cannot import                                                        |
| ------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| `domain/`           | nothing                                          | application, infrastructure, features, Payload, Next, React, zustand |
| `application/`      | domain                                           | infrastructure, features, any framework                              |
| `infrastructure/`   | application, domain, Payload                     | features                                                             |
| `features/`, `app/` | application, domain, `container`, `auth/session` | `infrastructure/payload/*`, `@/payload-types`                        |

### Who checks this rule?

The linter does. The rules are written in `eslint.config.mjs`. If you import something you shouldn't, `pnpm lint` fails with a message like:

```
Domain depends on nothing.
```

### Puzzle: how can a use case save data without importing Payload?

`moveTask` (in `application/`) needs to save the task to the database. But `application/` is not allowed to import Payload. How does it work?

The answer is a trick called **dependency inversion**. It works like a wall socket:

- The application layer says: "I need something with an `update` method. I don't care how it works." This promise is an **interface**, and in this project it's called a **port**.
- The infrastructure layer builds the real thing that keeps that promise, using Payload. This is called an **adapter** or **repository**.
- One file plugs them together.

In this project:

1. **The port.** `src/application/ports/repositories.ts` describes a `TaskRepository` with methods like `update(id, patch)`. It's just a description, with no real code.
2. **The use case uses the port.** `moveTask` calls `ctx.tasks.update(...)`. It doesn't know Payload exists.
3. **The adapter.** `src/infrastructure/payload/repositories/PayloadTaskRepository.ts` imports the port and does the real work with `payload.update(...)`.
4. **Plugging them together.** `src/infrastructure/container.ts` says `tasks: createPayloadTaskRepository(scope)`. This file is called the **composition root**.

So when the app **runs**, the call goes outward: use case, then repository, then Payload, then the database. But in the **source code**, the imports still point inward: the repository imports the port, and the port imports nothing from outside. That difference is the whole trick.

### Why follow this rule?

- **Fast tests without a database.** `tests/unit/inMemoryContext.ts` plugs in fake repositories that keep data in memory. So `pnpm test:unit` can test every use case without Postgres.
- **Each rule lives in one place.** `applyStatusChange` is written once, in the domain. The server uses it, and the browser board uses the same function.
- **Easy to change tools.** If you replaced Payload with something else, you would only rewrite `infrastructure/`. The domain and application layers would stay the same.

### One allowed exception

Pages need a way to get a real `AppContext` (the box of repositories). So presentation code is allowed to import two infrastructure files:

- `@/infrastructure/container`
- `@/infrastructure/auth/session`

Everything else in `infrastructure/payload/*` is off limits for presentation code.

### Try it

Add this line to the top of `src/domain/tasks/task.ts`:

```ts
import { getPayload } from 'payload'
```

Run `pnpm lint`. It fails with "Inner layers must stay framework-free." Now delete the line again.

---

## 4. Words you'll see a lot

| Word                  | What it means here                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Use case**          | A function for one user action, like `moveTask` or `createNote`. Lives in `src/application/`.                         |
| **Port**              | An interface (a promise of methods) that the application layer needs. Lives in `src/application/ports/`.              |
| **Repository**        | An object that loads and saves one kind of data, like tasks. The real ones use Payload.                               |
| **`AppContext`**      | A box holding all repositories and services. Every use case gets it as its first argument, `ctx`.                     |
| **Composition root**  | `src/infrastructure/container.ts`, the one place that builds a real `AppContext`.                                     |
| **Collection**        | Payload's word for a database table, like `tasks`. Defined in `src/infrastructure/payload/collections/`.              |
| **Access control**    | Payload rules that decide who can read or change a row.                                                               |
| **Server component**  | A React component that runs on the server. It can call use cases directly, with no API.                               |
| **Server action**     | A function marked `'use server'` that the browser can call like a normal function. Next.js sends the request for you. |
| **Optimistic update** | Update the screen first, save to the server second, and undo if saving fails. It makes the app feel fast.             |
| **Store**             | A zustand object holding data in the browser. Components read from it and re-render when it changes.                  |

---

## 5. Read the files in this order

Start from the inside (the simplest code) and move outward. Each layer only uses the layers you already read.

### Step 1: Domain (plain TypeScript, the easiest place to start)

- `src/domain/tasks/task.ts`: what a task is. Look for:
  - `TASK_STATUSES`: the three statuses.
  - `applyStatusChange`: sets `completedAt` when a task becomes `done`, and clears it when the task leaves `done`.
  - `positionBetween`: picks a number between two tasks, so a task can be placed between them on the board.
  - `isOverdue` and `isDueSoon`.
- `src/domain/notes/note.ts`: finds `[[wiki links]]` inside note text.
- `src/domain/projects/project.ts`: checks project input.
- `src/domain/shared/errors.ts`: error types like `ValidationError` and "not found".
- `tests/unit/domain.spec.ts`: the tests. Reading tests is the fastest way to see what each function should do.

### Step 2: Application (use cases)

- `src/application/context.ts`: the `AppContext` box.
- `src/application/ports/repositories.ts`: the port interfaces. Notice there is no real code here, only descriptions.
- `src/application/tasks/useCases.ts`: task actions. Read `moveTask` carefully. We'll follow it in section 6.
- `src/application/projects/useCases.ts`: archived projects can't be changed, and deleting a project also deletes its tasks.
- `src/application/notes/useCases.ts`: two notes can't have the same title (ignoring upper/lower case).
- `tests/unit/inMemoryContext.ts`: the fake repositories used by tests.

### Step 3: Infrastructure (the only place Payload is used)

- `src/payload.config.ts`: the main Payload setup. It lists the collections and connects to Postgres.
- `src/infrastructure/payload/collections/Tasks.ts`: the fields of the `tasks` table. Compare it with `Projects.ts` and `Notes.ts`.
- `src/infrastructure/payload/fields/owner.ts`: every row has an `owner`, the user who created it.
- `src/infrastructure/payload/access/index.ts`: `ownedByUser` makes sure a user only sees their own rows.
- `src/infrastructure/payload/repositories/PayloadTaskRepository.ts`: the real task repository. It calls `payload.find`, `payload.update`, and so on, always with `overrideAccess: false` so the access rules apply.
- `src/infrastructure/payload/richText.ts`: Payload stores notes in a format called Lexical JSON. This file converts it to and from markdown.
- `src/infrastructure/container.ts`: the composition root.
- `src/infrastructure/auth/session.ts`: finds out who is logged in, using the `payload-token` cookie.

### Step 4: Presentation (pages and UI)

- `src/features/shared/server.ts`:
  - `requireUser`: gets the logged-in user, or sends you to `/login`.
  - `getAppContext`: builds the `AppContext` for that user.
  - `loadOrNotFound`: runs a use case and shows a 404 page if the item doesn't exist.
- `src/features/shared/actionResult.ts`: `runAction` runs a use case inside a server action. If something goes wrong, it returns `{ ok: false, error }` instead of crashing.
- `src/features/tasks/`: everything for the task board: the store, the server actions, and the components.
- `src/features/shell/uiStore.ts`: remembers UI choices, like board view or list view.
- `src/app/(frontend)/(workspace)/`: the pages that need a login.
- `src/app/(frontend)/login/`: the login page, open to everyone.

---

## 6. Follow one feature: dragging a task on the board

This feature touches every layer. Open each file as you read each step.

1. **The page loads.**
   `src/app/(frontend)/(workspace)/projects/[id]/page.tsx` runs on the server. It calls the use case `getProjectBoard` through `loadOrNotFound`. There's no API call, because the page already runs on the server.

2. **The board store is created.**
   The page passes the tasks into `BoardStoreProvider`. This creates a zustand store for this one board, so the browser holds a copy of the tasks.

3. **You drop a card.**
   `KanbanBoard.tsx` notices the drop and calls `move()` in `src/features/tasks/useTaskMutations.ts`.

4. **The screen updates right away (optimistic update).**
   `move()` works out the new position, saves a copy of the old tasks (a "snapshot"), and moves the card in the store. You see the card move straight away.

5. **The browser asks the server to save.**
   `move()` calls `moveTaskAction` in `src/features/tasks/actions.ts`. This is a server action. It runs:

   ```ts
   runAction((ctx) => moveTask(ctx, input))
   ```

6. **The server builds the `AppContext`.**
   `runAction` gets the logged-in user and builds the `AppContext` with `container.ts`.

7. **The use case checks the rules.**
   `moveTask` in `src/application/tasks/useCases.ts`:
   - checks the project is not archived,
   - checks the neighbour tasks are in the right column,
   - works out the new position,
   - calls `applyStatusChange` from the domain.

8. **The task is saved.**
   `ctx.tasks.update(...)` goes to `PayloadTaskRepository.update`, which calls `payload.update`. Because of `overrideAccess: false`, the `ownedByUser` rule makes sure you can only change your own task.

9. **The result comes back.**
   - If saving **failed**, `useTaskMutations` puts the snapshot back and shows the error. The card jumps back.
   - If saving **worked**, `revalidatePath('/', 'layout')` tells Next.js to reload the server data, and the store gets the fresh tasks.

Notice that the browser store (`boardStore.ts`) and the server use case both call the **same** `applyStatusChange` function. So the quick update on screen always matches what the server saves.

---

## 7. Exercises

Do these in order. Each one teaches one idea.

1. **Why rules live in use cases.**
   Open `/admin`, find a task, and change its status to `done`. Look at `completedAt`: it doesn't change. The admin panel saves straight to Payload and skips the application layer, so the rule never runs. Now drag the same kind of task to "Done" in the main app. This time `completedAt` is set.

2. **Watch a use case run.**
   Add `console.log('moveTask', input)` at the start of `moveTask`. Drag a card. Look at the terminal where `pnpm dev` runs. The log appears there, not in the browser, because use cases run on the server.

3. **Break a rule on purpose.**
   Run `pnpm test:unit`. Everything passes. Now change `applyStatusChange` so it never sets `completedAt`. Run the tests again and read which ones fail and why. Then undo your change.

4. **Break the layer rule.**
   Do the "Try it" step from section 3.

5. **Add a small feature.**
   Add `'blocked'` to `TASK_STATUSES` in `src/domain/tasks/task.ts`. Run `pnpm typecheck` and fix each error it shows, layer by layer (for example, `TASK_STATUS_LABELS` needs a label for the new status). You don't need to edit the `tasks` collection by hand: `Tasks.ts` builds its status options from `TASK_STATUSES`. Run `pnpm generate:types` afterwards so `src/payload-types.ts` knows about the new status. This shows you how one change in the domain flows outward.

---

## 8. Learning Payload

Start with `.claude/skills/payload/SKILL.md`. For more detail, see `.claude/skills/payload/reference/`. Focus on these topics first:

- **Collections and fields**: how tables are defined.
- **Access control**: how `ownedByUser` works.
- **Local API**: `payload.find`, `payload.create`, `payload.update`, `payload.delete`.

You can skip Payload **hooks** at first. This project keeps its rules in use cases, not in hooks.

---

## 9. What to explore next

Once the task board makes sense, follow these two features the same way:

- **Notes and backlinks:**
  `NoteEditor.tsx` → `features/notes/actions.ts` → `application/notes/useCases.ts` → `PayloadNoteRepository.ts` (look for `linkKeys`) and `richText.ts`.
- **Login:**
  `LoginForm.tsx` → `features/auth/actions.ts` → `infrastructure/auth/session.ts` → `requireUser` in `features/shared/server.ts`.
