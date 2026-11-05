import type { Metadata } from 'next'
import Link from 'next/link'

import type { DashboardTask } from '@/application/dashboard/getDashboard'

import { getDashboard } from '@/application/dashboard/getDashboard'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { NoteListItem } from '@/features/notes/components/NoteListItem'
import { projectDotClass } from '@/features/projects/colors'
import { ProgressBar } from '@/features/projects/ProgressBar'
import { formatDueDate } from '@/features/shared/format'
import { SectionHeading } from '@/features/shared/headings'
import { PageHeader } from '@/features/shared/PageHeader'
import { getAppContext } from '@/features/shared/server'
import { PriorityBadge } from '@/features/tasks/components/PriorityBadge'
import { cn } from '@/utilities/ui'

export const metadata: Metadata = { title: 'Dashboard' }

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  const alert = tone === 'danger' && value > 0
  return (
    <Card className={cn('p-5', alert && 'border-error bg-error/10')}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-3xl font-semibold tabular-nums', alert && 'text-destructive-foreground')}>{value}</p>
    </Card>
  )
}

/** Task card with a count in the title; shrinks to one line when empty instead of stretching to the row height. */
function TaskSection({
  title,
  tasks,
  empty,
  tone,
}: {
  title: string
  tasks: DashboardTask[]
  empty: string
  tone?: 'danger'
}) {
  const alert = tone === 'danger' && tasks.length > 0
  return (
    <Card className={cn(tasks.length === 0 && 'self-start', alert && 'border-error')}>
      <CardHeader className={cn(tasks.length === 0 && 'pb-5')}>
        <SectionHeading className="flex items-baseline justify-between gap-2">
          <span className={cn(alert && 'text-destructive-foreground')}>{title}</span>
          <span className="text-sm font-normal tabular-nums text-muted-foreground">{tasks.length}</span>
        </SectionHeading>
        {tasks.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      </CardHeader>
      {tasks.length > 0 && (
        <CardContent>
          <TaskRows tasks={tasks} tone={tone} />
        </CardContent>
      )}
    </Card>
  )
}

function TaskRows({ tasks, tone }: { tasks: DashboardTask[]; tone?: 'danger' }) {
  return (
    <ul className="flex flex-col divide-y">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link href={`/projects/${task.projectId}`} className="flex items-baseline justify-between gap-3 py-2 hover:underline">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{task.title}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{task.projectName}</span>
                <PriorityBadge priority={task.priority} />
              </span>
            </span>
            {task.dueDate && (
              <span className={cn('shrink-0 text-xs', tone === 'danger' ? 'font-medium text-destructive-foreground' : 'text-muted-foreground')}>
                {formatDueDate(task.dueDate)}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function DashboardPage() {
  const { projects, overdue, dueSoon, inProgress, recentNotes, totals } = await getDashboard(await getAppContext())

  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Overdue" value={overdue.length} tone="danger" />
        <Stat label="Open tasks" value={totals.openTasks} />
        <Stat label="Done this week" value={totals.doneThisWeek} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TaskSection title="Overdue" tasks={overdue} empty="Nothing overdue." tone="danger" />
        <TaskSection title="Due in the next 7 days" tasks={dueSoon} empty="Nothing due soon." />
        <TaskSection title="In progress" tasks={inProgress} empty="Nothing in progress." />

        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionHeading>Projects</SectionHeading>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active projects. <Link href="/projects" className="underline">Create one</Link>.
              </p>
            ) : (
              projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="flex flex-col gap-1.5 hover:opacity-80">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className={cn('size-2 rounded-full', projectDotClass[project.color])} />
                    {project.name}
                  </span>
                  <ProgressBar progress={project.progress} color={project.color} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <SectionHeading>Recent notes</SectionHeading>
          </CardHeader>
          {recentNotes.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No notes yet. <Link href="/notes/new" className="underline">Write one</Link>.
              </p>
            </CardContent>
          ) : (
            <ul className="divide-y border-t">
              {recentNotes.map((note) => (
                <NoteListItem key={note.id} note={note} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
