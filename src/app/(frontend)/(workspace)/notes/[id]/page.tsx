import type { Metadata } from 'next'
import { CheckCircle2Icon, CircleIcon, FolderKanbanIcon, LinkIcon, PencilIcon } from 'lucide-react'
import Link from 'next/link'
import { cache } from 'react'

import { getNote } from '@/application/notes/useCases'
import { Button } from '@/components/ui/button'
import { DeleteNoteButton } from '@/features/notes/components/DeleteNoteButton'
import { NoteHtml } from '@/features/notes/components/NoteHtml'
import { formatRelative } from '@/features/shared/format'
import { PageHeader } from '@/features/shared/PageHeader'
import { loadOrNotFound } from '@/features/shared/server'

type Props = { params: Promise<{ id: string }> }

const loadNote = cache((id: string) => loadOrNotFound((ctx) => getNote(ctx, id)))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { note } = await loadNote((await params).id)
  return { title: note.title }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>

export default async function NotePage({ params }: Props) {
  const { id } = await params
  const { note, html, wikiLinks, backlinks, projects, tasks } = await loadNote(id)

  return (
    <>
      <PageHeader
        title={note.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {note.tags.map((tag) => (
              <Link key={tag} href={`/notes?tag=${encodeURIComponent(tag)}`} className="hover:text-foreground">
                #{tag}
              </Link>
            ))}
            <span>Updated {formatRelative(note.updatedAt)}</span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/notes/${note.id}/edit`}>
                <PencilIcon />
                Edit
              </Link>
            </Button>
            <DeleteNoteButton id={note.id} title={note.title} />
          </>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="min-w-0">
          {html ? <NoteHtml html={html} links={wikiLinks} /> : <Empty>This note is empty.</Empty>}
        </article>

        <aside className="flex flex-col gap-6">
          <Section title="Projects">
            {projects.length === 0 ? (
              <Empty>None</Empty>
            ) : (
              projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center gap-2 text-sm hover:underline">
                  <FolderKanbanIcon className="size-4 text-muted-foreground" />
                  {project.name}
                </Link>
              ))
            )}
          </Section>

          <Section title="Tasks">
            {tasks.length === 0 ? (
              <Empty>None</Empty>
            ) : (
              tasks.map((task) => (
                <Link key={task.id} href={`/projects/${task.projectId}`} className="flex items-center gap-2 text-sm hover:underline">
                  {task.status === 'done' ? (
                    <CheckCircle2Icon className="size-4 text-muted-foreground" />
                  ) : (
                    <CircleIcon className="size-4 text-muted-foreground" />
                  )}
                  <span className={task.status === 'done' ? 'line-through' : undefined}>{task.title}</span>
                </Link>
              ))
            )}
          </Section>

          <Section title="Links">
            {wikiLinks.length === 0 ? (
              <Empty>Use [[Title]] in the body to link notes.</Empty>
            ) : (
              wikiLinks.map((link) =>
                link.noteId ? (
                  <Link key={link.title} href={`/notes/${link.noteId}`} className="flex items-center gap-2 text-sm hover:underline">
                    <LinkIcon className="size-4 text-muted-foreground" />
                    {link.title}
                  </Link>
                ) : (
                  <Link
                    key={link.title}
                    href={`/notes/new?title=${encodeURIComponent(link.title)}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:underline"
                    title="Create this note"
                  >
                    <LinkIcon className="size-4" />
                    {link.title} <span className="text-xs">(new)</span>
                  </Link>
                ),
              )
            )}
          </Section>

          <Section title="Backlinks">
            {backlinks.length === 0 ? (
              <Empty>No notes link here yet.</Empty>
            ) : (
              backlinks.map((backlink) => (
                <Link key={backlink.id} href={`/notes/${backlink.id}`} className="flex items-center gap-2 text-sm hover:underline">
                  <LinkIcon className="size-4 rotate-180 text-muted-foreground" />
                  {backlink.title}
                </Link>
              ))
            )}
          </Section>
        </aside>
      </div>
    </>
  )
}
