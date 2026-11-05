import type { Metadata } from 'next'
import { PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import Link from 'next/link'

import { listNotes, listTags } from '@/application/notes/useCases'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NoteListItem } from '@/features/notes/components/NoteListItem'
import { PageHeader } from '@/features/shared/PageHeader'
import { getAppContext } from '@/features/shared/server'
import { cn } from '@/utilities/ui'

export const metadata: Metadata = { title: 'Notes' }

type Props = { searchParams: Promise<{ q?: string; tag?: string }> }

function FilterChip({ href, label, clearLabel }: { href: string; label: string; clearLabel: string }) {
  return (
    <Link
      href={href}
      aria-label={clearLabel}
      className="inline-flex max-w-full items-center gap-1 rounded-md border bg-secondary px-2 py-0.5 text-xs font-medium hover:bg-accent"
    >
      <span className="truncate">{label}</span>
      <XIcon className="size-3 shrink-0 text-muted-foreground" />
    </Link>
  )
}

export default async function NotesPage({ searchParams }: Props) {
  const { q = '', tag = '' } = await searchParams
  const ctx = await getAppContext()
  const [notes, tags] = await Promise.all([listNotes(ctx, { search: q, tag }), listTags(ctx)])

  const notesHref = (filters: { q?: string; tag?: string }) => {
    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    if (filters.tag) params.set('tag', filters.tag)
    const query = params.toString()
    return query ? `/notes?${query}` : '/notes'
  }
  // Clicking the selected tag again clears it.
  const tagHref = (value: string) => notesHref({ q, tag: value === tag ? '' : value })

  return (
    <>
      <PageHeader
        title="Notes"
        description={`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}${tag ? ` tagged #${tag}` : ''}`}
        actions={
          <Button asChild>
            <Link href="/notes/new">
              <PlusIcon />
              New note
            </Link>
          </Button>
        }
      />

      <form className="mb-4 flex max-w-md gap-2" role="search">
        {tag && <input type="hidden" name="tag" value={tag} />}
        <Input type="search" name="q" defaultValue={q} placeholder="Search titles…" aria-label="Search notes" />
        <Button type="submit" variant="outline" size="icon" aria-label="Search">
          <SearchIcon />
        </Button>
      </form>

      {(q || tag) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtered by</span>
          {q && <FilterChip href={notesHref({ tag })} label={`“${q}”`} clearLabel={`Clear search “${q}”`} />}
          {tag && <FilterChip href={notesHref({ q })} label={`#${tag}`} clearLabel={`Clear tag #${tag}`} />}
          <Link href="/notes" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Clear all
          </Link>
        </div>
      )}

      {tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {tags.map(({ tag: value, count }) => (
            <Link
              key={value}
              href={tagHref(value)}
              className={cn(
                'rounded-md border px-2 py-0.5 text-xs transition-colors',
                value === tag ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              #{value} <span className="opacity-60">{count}</span>
            </Link>
          ))}
        </div>
      )}

      {notes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {q || tag ? 'No notes match.' : 'No notes yet. Capture your first idea.'}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {notes.map((note) => (
              <NoteListItem key={note.id} note={note} />
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
