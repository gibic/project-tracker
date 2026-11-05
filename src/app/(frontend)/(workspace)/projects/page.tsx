import type { Metadata } from 'next'
import { ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'

import type { ProjectWithProgress } from '@/application/projects/useCases'

import { listProjects } from '@/application/projects/useCases'
import { Card } from '@/components/ui/card'
import { projectDotClass } from '@/features/projects/colors'
import { NewProjectButton } from '@/features/projects/NewProjectButton'
import { ProgressBar } from '@/features/projects/ProgressBar'
import { PageHeader } from '@/features/shared/PageHeader'
import { getAppContext } from '@/features/shared/server'
import { cn } from '@/utilities/ui'

export const metadata: Metadata = { title: 'Projects' }

function ProjectGrid({ projects }: { projects: ProjectWithProgress[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
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
            </div>
            <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
              {project.description || 'No description.'}
            </p>
            <ProgressBar progress={project.progress} color={project.color} />
          </Card>
        </Link>
      ))}
    </div>
  )
}

export default async function ProjectsPage() {
  const projects = await listProjects(await getAppContext(), { includeArchived: true })
  const active = projects.filter((p) => p.status === 'active')
  const archived = projects.filter((p) => p.status === 'archived')

  return (
    <>
      <PageHeader title="Projects" description={`${active.length} active`} actions={<NewProjectButton />} />

      {active.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {projects.length === 0 ? 'No projects yet. Create one to start tracking tasks.' : 'No active projects.'}
        </Card>
      ) : (
        <ProjectGrid projects={active} />
      )}

      {archived.length > 0 && (
        <details className="group/archived mt-10">
          <summary className="mb-4 flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 transition-transform group-open/archived:rotate-90" />
            Archived <span className="tabular-nums">({archived.length})</span>
          </summary>
          <ProjectGrid projects={archived} />
        </details>
      )}
    </>
  )
}
