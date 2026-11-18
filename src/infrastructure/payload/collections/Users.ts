import type { CollectionConfig } from 'payload'

import { authenticated, selfOnly } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    // The first user signs up through /admin/create-first-user, which skips access control.
    create: () => false,
    delete: selfOnly,
    read: selfOnly,
    update: selfOnly,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: {
    // API keys authenticate MCP clients (see src/app/(mcp)/mcp/route.ts).
    useAPIKey: true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
  ],
  timestamps: true,
}
