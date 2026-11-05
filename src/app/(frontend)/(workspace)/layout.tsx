import React from 'react'

import { listProjects } from '@/application/projects/useCases'
import { getAppContext, requireUser } from '@/features/shared/server'
import { Sidebar } from '@/features/shell/Sidebar'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  // Not awaited: the sidebar streams its project list so the page shell renders immediately.
  const projects = getAppContext()
    .then((ctx) => listProjects(ctx))
    .then((list) => list.map(({ id, name, color }) => ({ id, name, color })))

  return (
    <div className="md:flex">
      <Sidebar projects={projects} userLabel={user.name || user.email} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  )
}
