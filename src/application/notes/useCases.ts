import type { AppContext } from '../context'
import type { Note, NoteInput, NoteSummary } from '@/domain/notes/note'
import type { Project } from '@/domain/projects/project'
import type { ID } from '@/domain/shared/types'
import type { Task } from '@/domain/tasks/task'

import { deriveLinkKeys, extractWikiLinks, titleKey, validateNoteInput } from '@/domain/notes/note'
import { NotFoundError, ValidationError } from '@/domain/shared/errors'

const requireNote = async (ctx: AppContext, id: ID): Promise<Note> => {
  const note = await ctx.notes.findById(id)
  if (!note) throw new NotFoundError('Note', id)
  return note
}

/** Titles are unique per user, because `[[Title]]` links resolve by title. */
const assertTitleIsFree = async (ctx: AppContext, title: string, selfId?: ID): Promise<void> => {
  const clash = (await ctx.notes.findByTitleKeys([titleKey(title)])).find((n) => n.id !== selfId)
  if (clash) throw new ValidationError(`Another note is already titled "${clash.title}"`, 'title')
}

/** Keeps only project/task ids the current user can see, so a note never points at foreign data. */
const ownedReferences = async (ctx: AppContext, input: NoteInput) => {
  const [projects, tasks] = await Promise.all([
    input.projectIds.length ? ctx.projects.list() : Promise.resolve([]),
    input.taskIds.length ? ctx.tasks.list({ ids: input.taskIds }) : Promise.resolve([]),
  ])
  const projectIds = new Set(projects.map((p) => p.id))
  return {
    projectIds: input.projectIds.filter((id) => projectIds.has(id)),
    taskIds: tasks.map((t) => t.id),
  }
}

export type NoteFormInput = Partial<Record<keyof NoteInput, unknown>>

export const createNote = async (ctx: AppContext, input: NoteFormInput): Promise<Note> => {
  const fields = validateNoteInput(input)
  await assertTitleIsFree(ctx, fields.title)
  return ctx.notes.create({
    ...fields,
    ...(await ownedReferences(ctx, fields)),
    linkKeys: deriveLinkKeys(fields.body),
  })
}

export const updateNote = async (ctx: AppContext, id: ID, input: NoteFormInput): Promise<Note> => {
  await requireNote(ctx, id)
  const fields = validateNoteInput(input)
  await assertTitleIsFree(ctx, fields.title, id)
  return ctx.notes.update(id, {
    ...fields,
    ...(await ownedReferences(ctx, fields)),
    linkKeys: deriveLinkKeys(fields.body),
  })
}

export const deleteNote = async (ctx: AppContext, id: ID): Promise<void> => {
  await requireNote(ctx, id)
  await ctx.notes.delete(id)
}

export const listNotes = (
  ctx: AppContext,
  filter: { search?: string; tag?: string } = {},
): Promise<NoteSummary[]> =>
  ctx.notes.list({ search: filter.search?.trim() || undefined, tag: filter.tag || undefined })

export interface TagCount {
  tag: string
  count: number
}

export const listTags = async (ctx: AppContext): Promise<TagCount[]> => {
  const counts = new Map<string, number>()
  for (const note of await ctx.notes.list()) {
    for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export interface WikiLink {
  title: string
  /** Null when no note has this title yet. */
  noteId: ID | null
}

export interface NoteDetail {
  note: Note
  html: string
  wikiLinks: WikiLink[]
  backlinks: NoteSummary[]
  projects: Project[]
  tasks: Task[]
}

export const getNote = async (ctx: AppContext, id: ID): Promise<NoteDetail> => {
  const note = await requireNote(ctx, id)
  const titles = extractWikiLinks(note.body)

  const [html, linked, backlinks, projects, tasks] = await Promise.all([
    ctx.richText.toHtml(note.body),
    titles.length ? ctx.notes.findByTitleKeys(titles.map(titleKey)) : Promise.resolve([]),
    ctx.notes.list({ linksToKey: titleKey(note.title) }),
    note.projectIds.length ? ctx.projects.list() : Promise.resolve([]),
    note.taskIds.length ? ctx.tasks.list({ ids: note.taskIds }) : Promise.resolve([]),
  ])

  const idByKey = new Map(linked.map((n) => [titleKey(n.title), n.id]))

  return {
    note,
    html,
    wikiLinks: titles.map((title) => ({ title, noteId: idByKey.get(titleKey(title)) ?? null })),
    backlinks: backlinks.filter((n) => n.id !== id),
    projects: projects.filter((p) => note.projectIds.includes(p.id)),
    tasks,
  }
}

export interface NoteEditorOptions {
  projects: Project[]
  /** Open tasks of active projects, plus any task already linked to the note. */
  tasks: Task[]
}

export const getNoteEditorOptions = async (ctx: AppContext, linkedTaskIds: ID[] = []): Promise<NoteEditorOptions> => {
  const projects = await ctx.projects.list({ status: 'active' })
  const [open, linked] = await Promise.all([
    ctx.tasks.list({ projectIds: projects.map((p) => p.id), excludeStatus: 'done' }),
    linkedTaskIds.length ? ctx.tasks.list({ ids: linkedTaskIds }) : Promise.resolve([]),
  ])
  const tasks = [...open, ...linked.filter((t) => !open.some((o) => o.id === t.id))]
  return { projects, tasks }
}

export const previewMarkdown =(ctx: AppContext, markdown: unknown): Promise<string> =>
  ctx.richText.toHtml(typeof markdown === 'string' ? markdown : '')
