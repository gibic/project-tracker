import React from 'react'

import { listProjects } from '@/application/projects/useCases'
import { getAppContext, requireUser } from '@/features/shared/server'
import { Sidebar } from '@/features/shell/Sidebar'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const projects = await listProjects(await getAppContext())

  return (
    <div className="md:flex">
      <Sidebar
        projects={projects.map(({ id, name, color }) => ({ id, name, color }))}
        userLabel={user.name || user.email}
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  )
}
