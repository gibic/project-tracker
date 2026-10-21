import type { SanitizedConfig } from 'payload'

import {
  convertLexicalToMarkdown,
  convertMarkdownToLexical,
  editorConfigFactory,
} from '@payloadcms/richtext-lexical'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

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

export const createRichTextRenderer = (config: SanitizedConfig): RichTextRenderer => ({
  // The default HTML converters escape text nodes, so user content cannot inject markup.
  async toHtml(markdown) {
    if (!markdown.trim()) return ''
    return convertLexicalToHTML({ data: await markdownToLexical(config, markdown), disableContainer: true })
  },
})
