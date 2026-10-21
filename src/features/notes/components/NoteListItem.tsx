import Link from 'next/link'

import type { NoteSummary } from '@/domain/notes/note'

import { formatRelative } from '../../shared/format'

export function NoteListItem({ note }: { note: NoteSummary }) {
  return (
    <li>
      <Link href={`/notes/${note.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-accent/60">
        <span className="font-medium">{note.title}</span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {note.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
          <span>{formatRelative(note.updatedAt)}</span>
        </span>
      </Link>
    </li>
  )
}
