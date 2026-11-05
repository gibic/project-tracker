import type { Payload, Where } from 'payload'

import type { OAuthRepository } from '@/application/ports/repositories'
import type { OAuthClient, OAuthGrant, TokenEndpointAuthMethod } from '@/domain/oauth/oauth'
import type { OauthClient as ClientDoc, OauthGrant as GrantDoc } from '@/payload-types'

import { fromDbId, toDate, toDbId } from './shared'

/*
 * System-privileged on purpose: the token endpoint and bearer checks run before a user is
 * known. This is the only repository that bypasses access control (see OAuthRepository).
 */
const asSystem = { overrideAccess: true, depth: 0 } as const

const toClient = (doc: ClientDoc): OAuthClient => ({
  id: fromDbId(doc.id),
  clientId: doc.clientId,
  name: doc.name,
  redirectUris: Array.isArray(doc.redirectUris) ? doc.redirectUris.map(String) : [],
  tokenEndpointAuthMethod: doc.tokenEndpointAuthMethod as TokenEndpointAuthMethod,
  secretHash: doc.secretHash ?? null,
  createdAt: new Date(doc.createdAt),
})

const toGrant = (doc: GrantDoc): OAuthGrant => ({
  id: fromDbId(doc.id),
  userId: fromDbId(doc.owner),
  client: fromDbId(doc.client),
  redirectUri: doc.redirectUri,
  codeChallenge: doc.codeChallenge,
  codeHash: doc.codeHash ?? null,
  codeExpiresAt: toDate(doc.codeExpiresAt),
  accessTokenHash: doc.accessTokenHash ?? null,
  accessTokenExpiresAt: toDate(doc.accessTokenExpiresAt),
  refreshTokenHash: doc.refreshTokenHash ?? null,
  refreshTokenExpiresAt: toDate(doc.refreshTokenExpiresAt),
})

const toGrantData = (data: Partial<Omit<OAuthGrant, 'id'>>) => {
  const { userId, client, codeExpiresAt, accessTokenExpiresAt, refreshTokenExpiresAt, ...rest } = data
  const iso = (date: Date | null | undefined) => (date === undefined ? undefined : (date?.toISOString() ?? null))
  return Object.fromEntries(
    Object.entries({
      ...rest,
      owner: userId === undefined ? undefined : toDbId(userId),
      client: client === undefined ? undefined : toDbId(client),
      codeExpiresAt: iso(codeExpiresAt),
      accessTokenExpiresAt: iso(accessTokenExpiresAt),
      refreshTokenExpiresAt: iso(refreshTokenExpiresAt),
    }).filter(([, value]) => value !== undefined),
  )
}

export const createPayloadOAuthRepository = (payload: Payload): OAuthRepository => ({
  async createClient(data) {
    const doc = await payload.create({ collection: 'oauth-clients', data, ...asSystem })
    return toClient(doc)
  },

  async findClient(clientId) {
    const { docs } = await payload.find({
      collection: 'oauth-clients',
      where: { clientId: { equals: clientId } },
      limit: 1,
      ...asSystem,
    })
    return docs[0] ? toClient(docs[0]) : null
  },

  async createGrant(data) {
    const doc = await payload.create({
      collection: 'oauth-grants',
      data: toGrantData(data) as Omit<GrantDoc, 'id' | 'createdAt' | 'updatedAt'>,
      ...asSystem,
    })
    return toGrant(doc)
  },

  async findGrant(by) {
    const [field, value] = Object.entries(by)[0]
    const where: Where = { [field]: { equals: value } }
    const { docs } = await payload.find({ collection: 'oauth-grants', where, limit: 1, ...asSystem })
    return docs[0] ? toGrant(docs[0]) : null
  },

  async updateGrant(id, patch) {
    const doc = await payload.update({ collection: 'oauth-grants', id: toDbId(id), data: toGrantData(patch), ...asSystem })
    return toGrant(doc)
  },

  async deleteGrant(id) {
    await payload.delete({ collection: 'oauth-grants', id: toDbId(id), ...asSystem })
  },
})
