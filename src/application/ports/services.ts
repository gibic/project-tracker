export interface RichTextRenderer {
  /** Renders note markdown to sanitized HTML. */
  toHtml(markdown: string): Promise<string>
}

export interface Clock {
  now(): Date
  /** IANA zone whose calendar day is "today" for due dates; the runtime's zone when undefined. */
  timeZone?: string
}

export const systemClock: Clock = { now: () => new Date() }

export interface OAuthCrypto {
  /** Unguessable token (at least 256 bits of randomness) with a type prefix. */
  randomToken(prefix: string): string
  /** One-way hash used to store tokens and secrets. */
  hash(value: string): string
  /** PKCE S256: base64url(SHA-256(verifier)). */
  pkceChallenge(verifier: string): string
  /** Constant-time string comparison. */
  safeEqual(a: string, b: string): boolean
}
