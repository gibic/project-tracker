import type { Metadata } from 'next'
import Link from 'next/link'

import { listProjects } from '@/application/projects/useCases'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { projectDotClass } from '@/features/projects/colors'
import { NewProjectButton } from '@/features/projects/NewProjectButton'
import { ProgressBar } from '@/features/projects/ProgressBar'
import { PageHeader } from '@/features/shared/PageHeader'
import { getAppContext } from '@/features/shared/server'
import { cn } from '@/utilities/ui'

export const metadata: Metadata = { title: 'Projects' }

export default async function ProjectsPage() {
  const projects = await listProjects(await getAppContext(), { includeArchived: true })
  const active = projects.filter((p) => p.status === 'active')
  const archived = projects.filter((p) => p.status === 'archived')

  return (
    <>
      <PageHeader title="Projects" description={`${active.length} active`} actions={<NewProjectButton />} />

      {projects.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No projects yet. Create one to start tracking tasks.
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[...active, ...archived].map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className="group">
            <Card
              className={cn(
                'flex h-full flex-col gap-3 p-5 transition-colors group-hover:border-foreground/30',
                project.status === 'archived' && 'opacity-60',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn('size-2.5 rounded-full', projectDotClass[project.color])} />
                <h2 className="truncate font-medium">{project.name}</h2>
                {project.status === 'archived' && <Badge variant="outline">Archived</Badge>}
              </div>
              <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                {project.description || 'No description.'}
              </p>
              <ProgressBar progress={project.progress} color={project.color} />
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
