import type { SanitizedConfig } from 'payload'

import {
  convertLexicalToMarkdown,
  convertMarkdownToLexical,
  editorConfigFactory,
} from '@payloadcms/richtext-lexical'
import { convertLexicalToHTML, type HTMLConverters } from '@payloadcms/richtext-lexical/html'
import type { SerializedEditorState, SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical'

import type { RichTextRenderer } from '@/application/ports/services'

import { noteEditorFeatures } from './editor'

/*
 * Notes are stored as Lexical JSON (so the admin panel gets a real rich-text editor)
 * and exposed to the domain as markdown. All format conversion lives here.
 */

type EditorConfig = Awaited<ReturnType<typeof editorConfigFactory.fromFeatures>>

let editorConfig: Promise<EditorConfig> | undefined

const getEditorConfig = (config: SanitizedConfig): Promise<EditorConfig> =>
  (editorConfig ??= editorConfigFactory.fromFeatures({ config, features: noteEditorFeatures }))

export type LexicalState = SerializedEditorState

export const markdownToLexical = async (config: SanitizedConfig, markdown: string): Promise<LexicalState> =>
  convertMarkdownToLexical({ editorConfig: await getEditorConfig(config), markdown })

export const lexicalToMarkdown = async (
  config: SanitizedConfig,
  data: LexicalState | null | undefined,
): Promise<string> => {
  if (!data?.root) return ''
  return convertLexicalToMarkdown({ data, editorConfig: await getEditorConfig(config) })
}

type TableCellNode = SerializedLexicalNode & {
  children: SerializedLexicalNode[]
  headerState?: number
  colSpan?: number
  rowSpan?: number
}
type TableRowNode = SerializedLexicalNode & { children: TableCellNode[] }
type TableNode = SerializedLexicalNode & { children: TableRowNode[] }

// Lexical's header state is a bitmask; bit 1 marks a header row.
const isHeaderRow = (row: TableRowNode) =>
  row.children.length > 0 && row.children.every((cell) => ((cell.headerState ?? 0) & 1) === 1)

/*
 * The default table converters inline `border: 1px solid #ccc` on every cell and put all rows
 * in <tbody>. These emit plain semantic markup instead (leading header rows in <thead>,
 * no inline styles) so the workspace can theme tables with CSS.
 */
const tableConverters: HTMLConverters = {
  table: ({ node, nodesToHTML }) => {
    const rows = (node as TableNode).children
    const headerCount = rows.findIndex((row) => !isHeaderRow(row))
    const split = headerCount === -1 ? rows.length : headerCount
    const head = nodesToHTML({ nodes: rows.slice(0, split) }).join('')
    const body = nodesToHTML({ nodes: rows.slice(split) }).join('')
    return `<div class="note-table"><table>${head ? `<thead>${head}</thead>` : ''}${body ? `<tbody>${body}</tbody>` : ''}</table></div>`
  },
  tablerow: ({ node, nodesToHTML }) => `<tr>${nodesToHTML({ nodes: (node as TableRowNode).children }).join('')}</tr>`,
  tablecell: ({ node, nodesToHTML }) => {
    const cell = node as TableCellNode
    const tag = (cell.headerState ?? 0) > 0 ? 'th' : 'td'
    const colSpan = cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : ''
    const rowSpan = cell.rowSpan && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ''
    return `<${tag}${colSpan}${rowSpan}>${nodesToHTML({ nodes: cell.children }).join('')}</${tag}>`
  },
}

export const createRichTextRenderer = (config: SanitizedConfig): RichTextRenderer => ({
  // The default HTML converters escape text nodes, so user content cannot inject markup.
  async toHtml(markdown) {
    if (!markdown.trim()) return ''
    return convertLexicalToHTML({
      data: await markdownToLexical(config, markdown),
      disableContainer: true,
      converters: ({ defaultConverters }) => ({ ...defaultConverters, ...tableConverters }),
    })
  },
})
