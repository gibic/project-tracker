export interface RichTextRenderer {
  /** Renders note markdown to sanitized HTML. */
  toHtml(markdown: string): Promise<string>
}

export interface Clock {
  now(): Date
}

export const systemClock: Clock = { now: () => new Date() }
