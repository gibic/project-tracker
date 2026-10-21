import type { WikiLink } from '@/application/notes/useCases'

import { titleKey } from '@/domain/notes/note'
import { cn } from '@/utilities/ui'

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
const decode = (text: string) => text.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])

/**
 * Turns `[[Title]]` in already-escaped HTML into links. Resolved titles link to the note;
 * unresolved ones link to "new note" with the title prefilled.
 */
const linkify = (html: string, links: WikiLink[]): string => {
  const byKey = new Map(links.map((link) => [titleKey(link.title), link]))
  return html.replace(/\[\[([^\[\]<]+?)\]\]/g, (match, escapedTitle: string) => {
    const link = byKey.get(titleKey(decode(escapedTitle)))
    if (!link) return match
    return link.noteId
      ? `<a href="/notes/${encodeURIComponent(link.noteId)}" class="wiki-link">${escapedTitle}</a>`
      : `<a href="/notes/new?title=${encodeURIComponent(link.title)}" class="wiki-link wiki-link-missing" title="Create this note">${escapedTitle}</a>`
  })
}

/** Renders HTML produced by the server-side rich-text renderer (text is escaped there). */
export function NoteHtml({ html, links = [], className }: { html: string; links?: WikiLink[]; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert [&_.wiki-link]:font-medium [&_.wiki-link]:text-sky-700 [&_.wiki-link]:no-underline dark:[&_.wiki-link]:text-sky-400 [&_.wiki-link-missing]:border-b [&_.wiki-link-missing]:border-dashed [&_.wiki-link-missing]:opacity-70',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: linkify(html, links) }}
    />
  )
}
