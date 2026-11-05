import type { CollectionConfig, Field } from 'payload'

import { never, ownedByUser } from '../access'
import { ownerField } from '../fields/owner'

/** Token hashes are lookup keys only; never readable through the API or admin. */
const hashField = (name: string): Field => ({
  name,
  type: 'text',
  unique: true,
  index: true,
  access: { read: never },
  admin: { hidden: true },
})

const expiryField = (name: string): Field => ({ name, type: 'date', admin: { hidden: true } })

/** A user's authorization of an OAuth client. Delete one to revoke that app's access. */
export const OAuthGrants: CollectionConfig = {
  slug: 'oauth-grants',
  access: {
    create: () => false,
    update: () => false,
    read: ownedByUser,
    delete: ownedByUser,
  },
  admin: {
    defaultColumns: ['client', 'createdAt', 'refreshTokenExpiresAt'],
    group: 'OAuth',
    description: 'Apps you connected over OAuth. Delete an entry to revoke its access.',
  },
  fields: [
    { name: 'client', type: 'relationship', relationTo: 'oauth-clients', required: true, admin: { readOnly: true } },
    { name: 'redirectUri', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'codeChallenge', type: 'text', required: true, access: { read: never }, admin: { hidden: true } },
    hashField('codeHash'),
    expiryField('codeExpiresAt'),
    hashField('accessTokenHash'),
    expiryField('accessTokenExpiresAt'),
    hashField('refreshTokenHash'),
    {
      name: 'refreshTokenExpiresAt',
      label: 'Expires',
      type: 'date',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    ownerField,
  ],
  timestamps: true,
}
