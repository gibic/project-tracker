import type { CollectionConfig } from 'payload'

import { titleKey } from '@/domain/notes/note'
import { authenticated, ownedByUser } from '../access'
import { noteLexical } from '../editor'
import { ownerField } from '../fields/owner'

export const Notes: CollectionConfig = {
  slug: 'notes',
  access: {
    create: authenticated,
    read: ownedByUser,
    update: ownedByUser,
    delete: ownedByUser,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'tags', 'updatedAt'],
    group: 'Workspace',
  },
  indexes: [{ fields: ['owner', 'titleKey'], unique: true }],
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    {
      name: 'titleKey',
      type: 'text',
      index: true,
      admin: { hidden: true },
      hooks: {
        beforeChange: [({ siblingData }) => (siblingData.title ? titleKey(siblingData.title) : undefined)],
      },
    },
    { name: 'content', type: 'richText', editor: noteLexical },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
      admin: { position: 'sidebar', description: 'Lowercase, kebab-case.' },
    },
    {
      name: 'projects',
      type: 'relationship',
      relationTo: 'projects',
      hasMany: true,
      admin: { position: 'sidebar' },
      filterOptions: ({ user }) => (user ? { owner: { equals: user.id } } : false),
    },
    {
      name: 'tasks',
      type: 'relationship',
      relationTo: 'tasks',
      hasMany: true,
      admin: { position: 'sidebar' },
      filterOptions: ({ user }) => (user ? { owner: { equals: user.id } } : false),
    },
    {
      name: 'linkKeys',
      type: 'text',
      hasMany: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Derived from [[wiki links]] when saved from the workspace.',
      },
    },
    ownerField,
  ],
  timestamps: true,
}
