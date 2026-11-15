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
  BlocksFeature({ blocks: [CodeBlock()] }),
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
