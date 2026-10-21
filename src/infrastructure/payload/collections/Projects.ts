import type { CollectionConfig } from 'payload'

import { PROJECT_COLORS, PROJECT_STATUSES } from '@/domain/projects/project'
import { authenticated, ownedByUser } from '../access'
import { ownerField } from '../fields/owner'

export const Projects: CollectionConfig = {
  slug: 'projects',
  access: {
    create: authenticated,
    read: ownedByUser,
    update: ownedByUser,
    delete: ownedByUser,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'updatedAt'],
    group: 'Workspace',
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 80 },
    { name: 'description', type: 'textarea' },
    {
      name: 'color',
      type: 'select',
      required: true,
      defaultValue: 'slate',
      options: PROJECT_COLORS.map((value) => ({ label: value, value })),
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: PROJECT_STATUSES.map((value) => ({ label: value, value })),
      admin: { position: 'sidebar' },
    },
    {
      name: 'tasks',
      type: 'join',
      collection: 'tasks',
      on: 'project',
      admin: { defaultColumns: ['title', 'status', 'priority', 'dueDate'] },
    },
    ownerField,
  ],
  timestamps: true,
}
