import type { CollectionConfig } from 'payload'

import { CHECKLIST_TEXT_MAX } from '@/domain/tasks/checklist'
import { TASK_RECURRENCES, TASK_RECURRENCE_LABELS } from '@/domain/tasks/recurrence'
import { TASK_PRIORITIES, TASK_STATUSES, TASK_STATUS_LABELS } from '@/domain/tasks/task'
import { authenticated, ownedByUser } from '../access'
import { ownerField } from '../fields/owner'

/*
 * Business rules (completedAt, ordering, recurrence, archived projects) live in the application layer.
 * Edits made in the admin panel bypass them, so treat the admin as a raw data editor.
 */
export const Tasks: CollectionConfig = {
  slug: 'tasks',
  access: {
    create: authenticated,
    read: ownedByUser,
    update: ownedByUser,
    delete: ownedByUser,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'project', 'status', 'priority', 'dueDate'],
    group: 'Workspace',
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'description', type: 'textarea' },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      required: true,
      index: true,
      filterOptions: ({ user }) => (user ? { owner: { equals: user.id } } : false),
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'todo',
          index: true,
          options: TASK_STATUSES.map((value) => ({ label: TASK_STATUS_LABELS[value], value })),
        },
        {
          name: 'priority',
          type: 'select',
          required: true,
          defaultValue: 'medium',
          options: TASK_PRIORITIES.map((value) => ({ label: value, value })),
        },
        { name: 'dueDate', type: 'date', index: true },
      ],
    },
    {
      name: 'recurrence',
      type: 'select',
      options: TASK_RECURRENCES.map((value) => ({ label: TASK_RECURRENCE_LABELS[value], value })),
      admin: { description: 'Completing the task in the workspace creates the next occurrence.' },
    },
    {
      name: 'checklist',
      type: 'array',
      labels: { singular: 'Item', plural: 'Checklist' },
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'done', type: 'checkbox', defaultValue: false },
            { name: 'text', type: 'text', required: true, maxLength: CHECKLIST_TEXT_MAX },
            {
              name: 'position',
              type: 'number',
              required: true,
              defaultValue: 0,
              admin: { description: 'Order in the checklist; the workspace keeps it up to date.' },
            },
          ],
        },
      ],
    },
    { name: 'position', type: 'number', required: true, defaultValue: 0, admin: { position: 'sidebar' } },
    { name: 'completedAt', type: 'date', admin: { position: 'sidebar', readOnly: true } },
    ownerField,
  ],
  timestamps: true,
}
