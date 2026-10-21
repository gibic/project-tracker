import type { Access, FieldAccess, PayloadRequest } from 'payload'

export const authenticated = ({ req: { user } }: { req: PayloadRequest }): boolean => Boolean(user)

/** Row-level security: a user only sees and changes documents they own. */
export const ownedByUser: Access = ({ req: { user } }) => {
  if (!user) return false
  return { owner: { equals: user.id } }
}

export const never: FieldAccess = () => false
