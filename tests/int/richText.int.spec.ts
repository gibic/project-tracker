import { describe, expect, it } from 'vitest'

import { createRichTextRenderer, lexicalToMarkdown, markdownToLexical } from '@/infrastructure/payload/richText'
import config from '@/payload.config'

const table = '| Column | Type |\n| --- | --- |\n| `id` | `uuid` |\n| note | text |'

describe('rich text conversion', () => {
  it('renders markdown tables as HTML tables', async () => {
    const sanitized = await config
    const html = await createRichTextRenderer(sanitized).toHtml(table)
    expect(html).toContain('<div class="note-table"><table>')
    expect(html).toMatch(/<thead><tr><th>.*Column.*<\/th>/)
    expect(html).toContain('<tbody>')
    expect(html).toContain('<code>id</code>')
    expect(html).not.toContain('style=')
  })

  it('round-trips markdown tables', async () => {
    const sanitized = await config
    const markdown = await lexicalToMarkdown(sanitized, await markdownToLexical(sanitized, table))
    expect(markdown).toContain('| Column | Type |')
    expect(markdown).toContain('| note | text |')
  })
})
