import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import type { OAuthCrypto } from '@/application/ports/services'

const sha256 = (value: string) => createHash('sha256').update(value)

export const nodeOAuthCrypto: OAuthCrypto = {
  randomToken: (prefix) => prefix + randomBytes(32).toString('base64url'),
  hash: (value) => sha256(value).digest('hex'),
  pkceChallenge: (verifier) => sha256(verifier).digest('base64url'),
  safeEqual: (a, b) => {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    return left.length === right.length && timingSafeEqual(left, right)
  },
}
