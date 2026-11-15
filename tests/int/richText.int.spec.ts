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

  const code = 'Before\n\n```ts\nconst a = 1 < 2 && "[[Not a link]]"\n\nreturn a\n```\n\nAfter'

  it('renders fenced code blocks as escaped <pre><code>', async () => {
    const sanitized = await config
    const html = await createRichTextRenderer(sanitized).toHtml(code)
    expect(html).toContain('<pre><code class="language-ts">const a = 1 &#60; 2 &#38;&#38; &#34;[[Not a link]]&#34;\n\nreturn a</code></pre>')
    expect(html).toContain('After')
  })

  it('round-trips fenced code blocks', async () => {
    const sanitized = await config
    const markdown = await lexicalToMarkdown(sanitized, await markdownToLexical(sanitized, code))
    expect(markdown).toContain('```ts\nconst a = 1 < 2 && "[[Not a link]]"\n\nreturn a\n```')
  })
})
