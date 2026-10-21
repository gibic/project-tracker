import {
  BlockquoteFeature,
  BoldFeature,
  ChecklistFeature,
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
  FixedToolbarFeature(),
  InlineToolbarFeature(),
]

export const defaultLexical = lexicalEditor({ features: noteEditorFeatures })
