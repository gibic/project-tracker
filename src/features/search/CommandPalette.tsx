'use client'

import {
  ArrowLeftIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleIcon,
  FilePlusIcon,
  FolderKanbanIcon,
  FolderPlusIcon,
  LayoutDashboardIcon,
  ListPlusIcon,
  NotebookPenIcon,
  SearchIcon,
  type LucideIcon,
} from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Suspense, use, useEffect, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from 'react'

import type { Project } from '@/domain/projects/project'
import type { TaskStatus } from '@/domain/tasks/task'

import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { MAX_SEARCH_QUERY, matchesSearchTerms, parseSearchTerms, type SearchKind } from '@/domain/search/search'
import { TASK_STATUS_LABELS } from '@/domain/tasks/task'
import { cn } from '@/utilities/ui'
import { createProjectAction } from '../projects/actions'
import { projectDotClass } from '../projects/colors'
import { useUIStore } from '../shell/uiStore'
import { createTaskAction } from '../tasks/actions'
import { usePaletteSearch } from './usePaletteSearch'

export type PaletteProject = Pick<Project, 'id' | 'name' | 'color'>

type Page =
  | { kind: 'root' }
  | { kind: 'notes' }
  | { kind: 'pick-project' }
  | { kind: 'new-task'; project: PaletteProject }
  | { kind: 'new-project' }

const PLACEHOLDER: Record<Page['kind'], string> = {
  root: 'Search projects, tasks and notes, or type a command…',
  notes: 'Search notes…',
  'pick-project': 'Pick a project for the new task…',
  'new-task': 'Task title…',
  'new-project': 'Project name…',
}

const MAX_LENGTH: Record<Page['kind'], number> = {
  root: MAX_SEARCH_QUERY,
  notes: MAX_SEARCH_QUERY,
  'pick-project': 80,
  'new-task': 200,
  'new-project': 80,
}

const STATUS_ICON: Record<TaskStatus, LucideIcon> = {
  todo: CircleIcon,
  in_progress: CircleDotIcon,
  done: CircleCheckIcon,
}

const taskHref = (projectId: string, taskId: string) => `/projects/${projectId}?task=${taskId}`

/** Opens with ⌘K / Ctrl+K anywhere in the workspace, or from the sidebar search button. */
export function CommandPalette({ projects }: { projects: Promise<PaletteProject[]> }) {
  const open = useUIStore((s) => s.paletteOpen)
  const setOpen = useUIStore((s) => s.setPaletteOpen)
  const pathname = usePathname()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      event.preventDefault()
      setOpen(!useUIStore.getState().paletteOpen)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  useEffect(() => setOpen(false), [pathname, setOpen])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label="Command palette"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === ref.current) setOpen(false)
      }}
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-lg backdrop:bg-black/50"
    >
      {/* Mounted only while open, so every opening starts fresh on the root page. */}
      {open && (
        <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading…</p>}>
          <PaletteBody projects={projects} close={() => setOpen(false)} />
        </Suspense>
      )}
    </dialog>
  )
}

function PaletteBody({ projects, close }: { projects: Promise<PaletteProject[]>; close: () => void }) {
  const activeProjects = use(projects)
  const router = useRouter()
  const [pages, setPages] = useState<Page[]>([{ kind: 'root' }])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const page = pages[pages.length - 1]

  const push = (next: Page) => {
    setPages((stack) => [...stack, next])
    setQuery('')
    setError(null)
  }
  const back = () => {
    setPages((stack) => stack.slice(0, -1))
    setQuery('')
    setError(null)
  }
  const go = (href: string) => {
    close()
    router.push(href)
  }

  const submit = (create: () => Promise<{ ok: true; href: string } | { ok: false; error: string }>) =>
    startTransition(async () => {
      const result = await create()
      if (result.ok) go(result.href)
      else setError(result.error)
    })

  const createTask = (project: PaletteProject, title: string) =>
    submit(async () => {
      const result = await createTaskAction({ projectId: project.id, title })
      return result.ok ? { ok: true, href: taskHref(project.id, result.data.id) } : result
    })

  const createProject = (name: string) =>
    submit(async () => {
      const result = await createProjectAction({ name })
      return result.ok ? { ok: true, href: `/projects/${result.data.id}` } : result
    })

  const onKeyDown = (event: KeyboardEvent) => {
    if (pages.length === 1) return
    if ((event.key === 'Backspace' && query === '') || event.key === 'Escape') {
      event.preventDefault()
      back()
    }
  }

  return (
    <Command shouldFilter={false} loop onKeyDown={onKeyDown} label="Command palette">
      {page.kind !== 'root' && (
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
          <button type="button" onClick={back} aria-label="Back" className="rounded-sm p-0.5 hover:bg-accent">
            <ArrowLeftIcon className="size-3.5" />
          </button>
          <span className="truncate">{pageTitle(page)}</span>
        </div>
      )}
      <CommandInput
        value={query}
        onValueChange={(value) => {
          setQuery(value)
          setError(null)
        }}
        placeholder={PLACEHOLDER[page.kind]}
        maxLength={MAX_LENGTH[page.kind]}
        disabled={pending}
        autoFocus
      />
      {error && (
        <p role="alert" className="border-b px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <CommandList>
        {page.kind === 'root' && <RootPage query={query} projects={activeProjects} go={go} push={push} />}
        {page.kind === 'notes' && <ResultsPage query={query} kinds={['note']} limit={10} go={go} />}
        {page.kind === 'pick-project' && (
          <ProjectPicker query={query} projects={activeProjects} onPick={(project) => push({ kind: 'new-task', project })} />
        )}
        {page.kind === 'new-task' && (
          <CreateItem
            value={query}
            label={(title) => `Create task “${title}” in ${page.project.name}`}
            hint="Type a title, then press Enter."
            icon={ListPlusIcon}
            pending={pending}
            onCreate={(title) => createTask(page.project, title)}
          />
        )}
        {page.kind === 'new-project' && (
          <CreateItem
            value={query}
            label={(name) => `Create project “${name}”`}
            hint="Type a name, then press Enter."
            icon={FolderPlusIcon}
            pending={pending}
            onCreate={createProject}
          />
        )}
      </CommandList>
      <div className="flex items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
        </span>
        <span>
          <Kbd>↵</Kbd> select
        </span>
        <span className="ml-auto">
          <Kbd>esc</Kbd> {pages.length > 1 ? 'back' : 'close'}
        </span>
      </div>
    </Command>
  )
}

const pageTitle = (page: Exclude<Page, { kind: 'root' }>): string => {
  switch (page.kind) {
    case 'notes':
      return 'Go to note'
    case 'pick-project':
      return 'New task'
    case 'new-task':
      return `New task in ${page.project.name}`
    case 'new-project':
      return 'New project'
  }
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border bg-muted px-1 font-sans text-[0.7rem]">{children}</kbd>
}

interface Action {
  id: string
  label: string
  icon: LucideIcon
  /** Extra words the action matches, besides its label. */
  keywords?: string
  /** Hidden until the user types, to keep the empty palette short. */
  onlyWhenSearching?: boolean
  run: () => void
}

function RootPage({
  query,
  projects,
  go,
  push,
}: {
  query: string
  projects: PaletteProject[]
  go: (href: string) => void
  push: (page: Page) => void
}) {
  const terms = parseSearchTerms(query)
  const title = query.trim()

  const navigation: Action[] = [
    { id: 'go-dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, keywords: 'go home overview', run: () => go('/') },
    { id: 'go-projects', label: 'Projects', icon: FolderKanbanIcon, keywords: 'go list', run: () => go('/projects') },
    { id: 'go-notes', label: 'Notes', icon: NotebookPenIcon, keywords: 'go list', run: () => go('/notes') },
    { id: 'find-note', label: 'Go to note…', icon: SearchIcon, keywords: 'find open search', run: () => push({ kind: 'notes' }) },
  ]
  const create: Action[] = [
    ...(projects.length
      ? [{ id: 'new-task', label: 'New task…', icon: ListPlusIcon, keywords: 'create add todo', run: () => push({ kind: 'pick-project' }) }]
      : []),
    ...projects.map((project) => ({
      id: `new-task-${project.id}`,
      label: `New task in ${project.name}`,
      icon: ListPlusIcon,
      keywords: 'create add todo',
      onlyWhenSearching: true,
      run: () => push({ kind: 'new-task', project }),
    })),
    { id: 'new-note', label: 'New note', icon: FilePlusIcon, keywords: 'create add write', run: () => go('/notes/new') },
    { id: 'new-project', label: 'New project', icon: FolderPlusIcon, keywords: 'create add', run: () => push({ kind: 'new-project' }) },
  ]

  const visible = (actions: Action[]) =>
    terms.length
      ? actions.filter((a) => matchesSearchTerms(`${a.label} ${a.keywords ?? ''}`, terms))
      : actions.filter((a) => !a.onlyWhenSearching)
  const navigationItems = visible(navigation)
  const createItems = visible(create)

  return (
    <>
      {terms.length > 0 && <SearchResultGroups query={query} limit={5} go={go} />}
      <ActionGroup heading="Navigation" actions={navigationItems} />
      {(createItems.length > 0 || title) && (
        <CommandGroup heading="Create">
          {createItems.map((action) => (
            <ActionItem key={action.id} action={action} />
          ))}
          {title && (
            <CommandItem value="create-note-with-title" onSelect={() => go(`/notes/new?title=${encodeURIComponent(title)}`)}>
              <FilePlusIcon />
              <span className="truncate">Create note “{title}”</span>
            </CommandItem>
          )}
        </CommandGroup>
      )}
    </>
  )
}

function ActionGroup({ heading, actions }: { heading: string; actions: Action[] }) {
  if (actions.length === 0) return null
  return (
    <CommandGroup heading={heading}>
      {actions.map((action) => (
        <ActionItem key={action.id} action={action} />
      ))}
    </CommandGroup>
  )
}

function ActionItem({ action }: { action: Action }) {
  const Icon = action.icon
  return (
    <CommandItem value={action.id} onSelect={action.run}>
      <Icon />
      <span className="truncate">{action.label}</span>
    </CommandItem>
  )
}

function ResultsPage(props: { query: string; kinds: SearchKind[]; limit: number; go: (href: string) => void }) {
  if (parseSearchTerms(props.query).length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Start typing to search.</p>
  }
  return (
    <>
      <SearchResultGroups {...props} />
      <CommandEmpty>No matches.</CommandEmpty>
    </>
  )
}

/** Server-side full-text results (`GET /search`), grouped by kind. */
function SearchResultGroups({
  query,
  kinds,
  limit,
  go,
}: {
  query: string
  kinds?: SearchKind[]
  limit: number
  go: (href: string) => void
}) {
  const { results, loading, error } = usePaletteSearch(query, { kinds, limit })
  const { projects, tasks, notes } = results
  const empty = projects.length + tasks.length + notes.length === 0

  return (
    <>
      {error && <p className="px-3 py-2 text-sm text-destructive">{error}</p>}
      {loading && empty && (
        <CommandLoading>
          <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
        </CommandLoading>
      )}
      {projects.length > 0 && (
        <CommandGroup heading="Projects">
          {projects.map((project) => (
            <CommandItem key={project.id} value={`project-${project.id}`} onSelect={() => go(`/projects/${project.id}`)}>
              <span className={cn('ml-1 size-2 shrink-0 rounded-full', projectDotClass[project.color])} />
              <ResultText title={project.name} snippet={project.snippet} />
              {project.status === 'archived' && <Badge variant="outline">Archived</Badge>}
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {tasks.length > 0 && (
        <CommandGroup heading="Tasks">
          {tasks.map((task) => {
            const Icon = STATUS_ICON[task.status]
            return (
              <CommandItem key={task.id} value={`task-${task.id}`} onSelect={() => go(taskHref(task.project.id, task.id))}>
                <Icon aria-label={TASK_STATUS_LABELS[task.status]} />
                <ResultText title={task.title} snippet={task.snippet} done={task.status === 'done'} />
                <CommandShortcut className="flex max-w-[40%] items-center gap-1.5 tracking-normal">
                  <span className={cn('size-2 shrink-0 rounded-full', projectDotClass[task.project.color])} />
                  <span className="truncate">{task.project.name}</span>
                </CommandShortcut>
              </CommandItem>
            )
          })}
        </CommandGroup>
      )}
      {notes.length > 0 && (
        <CommandGroup heading="Notes">
          {notes.map((note) => (
            <CommandItem key={note.id} value={`note-${note.id}`} onSelect={() => go(`/notes/${note.id}`)}>
              <NotebookPenIcon />
              <ResultText title={note.title} snippet={note.snippet} />
              {note.tags.length > 0 && (
                <CommandShortcut className="max-w-[30%] truncate tracking-normal">
                  {note.tags.map((tag) => `#${tag}`).join(' ')}
                </CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {!empty && <CommandSeparator />}
    </>
  )
}

function ResultText({ title, snippet, done = false }: { title: string; snippet: string; done?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={cn('truncate', done && 'text-muted-foreground line-through')}>{title}</span>
      {snippet && snippet !== title && <span className="truncate text-xs text-muted-foreground">{snippet}</span>}
    </span>
  )
}

function ProjectPicker({
  query,
  projects,
  onPick,
}: {
  query: string
  projects: PaletteProject[]
  onPick: (project: PaletteProject) => void
}) {
  const terms = parseSearchTerms(query)
  const matches = terms.length ? projects.filter((p) => matchesSearchTerms(p.name, terms)) : projects
  if (matches.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No active project matches.</p>
  }
  return (
    <CommandGroup heading="Active projects">
      {matches.map((project) => (
        <CommandItem key={project.id} value={`pick-${project.id}`} onSelect={() => onPick(project)}>
          <span className={cn('ml-1 size-2 shrink-0 rounded-full', projectDotClass[project.color])} />
          <span className="truncate">{project.name}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

function CreateItem({
  value,
  label,
  hint,
  icon: Icon,
  pending,
  onCreate,
}: {
  value: string
  label: (text: string) => string
  hint: string
  icon: LucideIcon
  pending: boolean
  onCreate: (text: string) => void
}) {
  const text = value.trim()
  if (!text) return <p className="py-6 text-center text-sm text-muted-foreground">{hint}</p>
  return (
    <CommandGroup>
      <CommandItem value="create" disabled={pending} onSelect={() => onCreate(text)}>
        <Icon />
        <span className="truncate">{pending ? 'Creating…' : label(text)}</span>
      </CommandItem>
    </CommandGroup>
  )
}
