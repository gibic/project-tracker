import type { RelationshipField } from 'payload'

import { never } from '../access'

/**
 * Stamps the creating user on every document. Cannot be changed afterwards,
 * so `ownedByUser` access can trust it.
 */
export const ownerField: RelationshipField = {
  name: 'owner',
  type: 'relationship',
  relationTo: 'users',
  required: true,
  index: true,
  access: { update: never },
  admin: { position: 'sidebar', readOnly: true },
  hooks: {
    beforeValidate: [
      ({ operation, req, value }) => (operation === 'create' && req.user ? req.user.id : value),
    ],
  },
}
