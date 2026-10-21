import type { Metadata } from 'next'
import { PlusIcon, SearchIcon } from 'lucide-react'
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

export default async function NotesPage({ searchParams }: Props) {
  const { q = '', tag = '' } = await searchParams
  const ctx = await getAppContext()
  const [notes, tags] = await Promise.all([listNotes(ctx, { search: q, tag }), listTags(ctx)])

  const tagHref = (value: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (value && value !== tag) params.set('tag', value)
    const query = params.toString()
    return query ? `/notes?${query}` : '/notes'
  }

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
