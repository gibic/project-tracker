import type { ElementType } from 'react'

import parse, {
  type DOMNode,
  Element,
  type HTMLReactParserOptions,
  attributesToProps,
  domToReact,
} from 'html-react-parser'

import type { WikiLink } from '@/application/notes/useCases'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { titleKey } from '@/domain/notes/note'
import { cn } from '@/utilities/ui'

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}
const decode = (text: string) =>
  text.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])

/**
 * Turns `[[Title]]` in already-escaped HTML into links. Resolved titles link to the note;
 * unresolved ones link to "new note" with the title prefilled.
 */
const linkify = (html: string, links: WikiLink[]): string => {
  const byKey = new Map(links.map((link) => [titleKey(link.title), link]))
  const linkifyText = (text: string) =>
    text.replace(/\[\[([^\[\]<]+?)\]\]/g, (match, escapedTitle: string) => {
      const link = byKey.get(titleKey(decode(escapedTitle)))
      if (!link) return match
      return link.noteId
        ? `<a href="/notes/${encodeURIComponent(link.noteId)}" class="wiki-link">${escapedTitle}</a>`
        : `<a href="/notes/new?title=${encodeURIComponent(link.title)}" class="wiki-link wiki-link-missing" title="Create this note">${escapedTitle}</a>`
    })
  // Code blocks render literally, so `[[...]]` inside them stays text.
  return html
    .split(/(<pre>[\s\S]*?<\/pre>)/)
    .map((part) => (part.startsWith('<pre>') ? part : linkifyText(part)))
    .join('')
}

const tableParts: Record<string, ElementType> = {
  thead: TableHeader,
  tbody: TableBody,
  tr: TableRow,
  th: TableHead,
  td: TableCell,
}

/** Swaps the renderer's plain table markup for shadcn Table components and styles inline code. */
const parserOptions: HTMLReactParserOptions = {
  replace(node) {
    if (!(node instanceof Element)) return
    const children = () => domToReact(node.children as DOMNode[], parserOptions)

    if (node.name === 'div' && node.attribs.class === 'note-table') return <>{children()}</>
    if (node.name === 'table') {
      return (
        <div className="not-prose my-6 overflow-hidden rounded-md border">
          <Table>{children()}</Table>
        </div>
      )
    }
    if (node.name === 'pre') {
      const code = node.children.find((child) => child instanceof Element && child.name === 'code')
      const language = code instanceof Element ? /language-([\w-]+)/.exec(code.attribs.class ?? '')?.[1] : undefined
      return (
        <div className="not-prose my-6 overflow-hidden rounded-md border bg-muted/50">
          {language && (
            <div className="border-b px-4 py-1.5 font-mono text-xs text-muted-foreground">{language}</div>
          )}
          <pre className="overflow-x-auto p-4 font-mono text-[0.8125rem] leading-relaxed">
            {code instanceof Element ? domToReact(code.children as DOMNode[]) : children()}
          </pre>
        </div>
      )
    }
    const Part = tableParts[node.name]
    if (Part) return <Part {...attributesToProps(node.attribs)}>{children()}</Part>
    if (node.name === 'code' && !(node.parent instanceof Element && node.parent.name === 'pre')) {
      return (
        <code className="rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-[0.875em] font-semibold whitespace-nowrap">
          {children()}
        </code>
      )
    }
  },
}

/** Renders HTML produced by the server-side rich-text renderer (text is escaped there). */
export function NoteHtml({
  html,
  links = [],
  className,
}: {
  html: string
  links?: WikiLink[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert prose-code:before:content-none prose-code:after:content-none',
        '[&_.wiki-link]:font-medium [&_.wiki-link]:text-link [&_.wiki-link]:no-underline [&_.wiki-link-missing]:border-b [&_.wiki-link-missing]:border-dashed [&_.wiki-link-missing]:opacity-70',
        '[&_.not-prose_a:not(.wiki-link)]:underline [&_.not-prose_a:not(.wiki-link)]:underline-offset-4',
        className,
      )}
    >
      {parse(linkify(html, links), parserOptions)}
    </div>
  )
}
