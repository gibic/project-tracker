import type { CollectionConfig } from 'payload'

import { TOKEN_ENDPOINT_AUTH_METHODS } from '@/domain/oauth/oauth'
import { authenticated, never } from '../access'

/** MCP clients registered through OAuth dynamic client registration (`/oauth/register`). */
export const OAuthClients: CollectionConfig = {
  slug: 'oauth-clients',
  access: {
    // Created only by the registration endpoint (system privileges); viewable and removable in the admin.
    create: () => false,
    update: () => false,
    read: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'clientId', 'createdAt'],
    group: 'OAuth',
    description: 'Apps registered through OAuth. Deleting one disconnects every user of that app.',
  },
  hooks: {
    // Grants reference their client (NOT NULL), so remove them first: deleting a client revokes it.
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({
          collection: 'oauth-grants',
          where: { client: { equals: id } },
          overrideAccess: true,
          req,
        })
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'clientId', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: 'redirectUris', type: 'json', required: true, admin: { readOnly: true } },
    {
      name: 'tokenEndpointAuthMethod',
      type: 'select',
      required: true,
      options: TOKEN_ENDPOINT_AUTH_METHODS.map((value) => ({ label: value, value })),
      admin: { readOnly: true },
    },
    { name: 'secretHash', type: 'text', access: { read: never }, admin: { hidden: true } },
  ],
  timestamps: true,
}
