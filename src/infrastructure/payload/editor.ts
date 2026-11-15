import type { Block } from 'payload'

import {
  BlockquoteFeature,
  BlocksFeature,
  BoldFeature,
  ChecklistFeature,
  CodeBlock,
  EXPERIMENTAL_TableFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineCodeFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

const premadeCodeBlock = CodeBlock()

/*
 * Two fixes to the premade block:
 * - It stores `language` as a select of Monaco ids (`javascript`, `typescript`, ...), so saving a
 *   fence tagged `js`, `bash` or `json`, or an untagged fence, fails validation. A free-text
 *   field keeps whatever tag the markdown used.
 * - Its markdown import turns an untagged one-line fence into `undefined<code>`, and its export
 *   writes untagged one-line code as ```code```. These always use a multi-line fence.
 */
const codeBlock: Block = {
  ...premadeCodeBlock,
  fields: premadeCodeBlock.fields.map((field) =>
    'name' in field && field.name === 'language'
      ? { name: 'language', type: 'text', admin: { hidden: true } }
      : field,
  ),
  jsx: {
    ...premadeCodeBlock.jsx,
    import: ({ children, openMatch }) => ({
      code: children.replace(/^\n/, '').replace(/\n$/, ''),
      language: openMatch?.[1] ?? '',
    }),
    export: ({ fields }) => `\`\`\`${fields.language ?? ''}\n${fields.code ?? ''}\n\`\`\``,
  },
}

/**
 * Features limited to what round-trips through markdown, because the workspace
 * edits notes as markdown while the admin panel edits the same field as rich text.
 */
export const noteEditorFeatures = [
  ParagraphFeature(),
  HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
  BoldFeature(),
  ItalicFeature(),
  StrikethroughFeature(),
  InlineCodeFeature(),
  // External URLs only: internal document links do not survive markdown conversion.
  LinkFeature({ enabledCollections: [] }),
  UnorderedListFeature(),
  OrderedListFeature(),
  ChecklistFeature(),
  BlockquoteFeature(),
  HorizontalRuleFeature(),
  EXPERIMENTAL_TableFeature(),
  // Fenced ``` code blocks; the premade block ships its own markdown transformer.
  BlocksFeature({ blocks: [codeBlock] }),
  FixedToolbarFeature(),
  InlineToolbarFeature(),
]

/*
 * The config-level editor cannot hold BlocksFeature: block fields are sanitized against the
 * config-level editor, so config loading waits on itself and never settles. It stays a plain
 * editor and the notes field sets `noteLexical` explicitly.
 */
export const defaultLexical = lexicalEditor({
  features: noteEditorFeatures.filter((feature) => feature.key !== 'blocks'),
})

export const noteLexical = lexicalEditor({ features: noteEditorFeatures })
