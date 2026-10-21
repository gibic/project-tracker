import type { ID } from '../shared/types'

import { ValidationError } from '../shared/errors'
import { oneOf, optionalText, requireText } from '../shared/validation'

export const PROJECT_COLORS = ['slate', 'red', 'amber', 'emerald', 'sky', 'violet', 'pink'] as const
export type ProjectColor = (typeof PROJECT_COLORS)[number]

export const PROJECT_STATUSES = ['active', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export interface Project {
  id: ID
  name: string
  description: string
  color: ProjectColor
  status: ProjectStatus
  createdAt: Date
  updatedAt: Date
}

export interface ProjectInput {
  name: string
  description: string
  color: ProjectColor
}

export const validateProjectInput = (input: Partial<Record<keyof ProjectInput, unknown>>): ProjectInput => ({
  name: requireText(input.name, 'name', { max: 80 }),
  description: optionalText(input.description, 'description', 2000),
  color: input.color === undefined ? 'slate' : oneOf(input.color, PROJECT_COLORS, 'color'),
})

/** Archived projects are read-only: no new or changed tasks. */
export const assertProjectIsActive = (project: Project): void => {
  if (project.status === 'archived') {
    throw new ValidationError(`Project "${project.name}" is archived. Restore it before changing tasks.`)
  }
}
