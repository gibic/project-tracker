import type { Metadata } from 'next'
import Link from 'next/link'

import type { DashboardTask } from '@/application/dashboard/getDashboard'

import { getDashboard } from '@/application/dashboard/getDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NoteListItem } from '@/features/notes/components/NoteListItem'
import { projectDotClass } from '@/features/projects/colors'
import { ProgressBar } from '@/features/projects/ProgressBar'
import { formatDueDate } from '@/features/shared/format'
import { PageHeader } from '@/features/shared/PageHeader'
import { getAppContext } from '@/features/shared/server'
import { PRIORITY_LABELS } from '@/features/tasks/labels'
import { cn } from '@/utilities/ui'

export const metadata: Metadata = { title: 'Dashboard' }

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </Card>
  )
}

function TaskRows({ tasks, empty, tone }: { tasks: DashboardTask[]; empty: string; tone?: 'danger' }) {
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="flex flex-col divide-y">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link href={`/projects/${task.projectId}`} className="flex items-baseline justify-between gap-3 py-2 hover:underline">
            <span className="min-w-0">
              <span className="block truncate text-sm">{task.title}</span>
              <span className="text-xs text-muted-foreground">
                {task.projectName} · {PRIORITY_LABELS[task.priority]}
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
        <Stat label="Open tasks" value={totals.openTasks} />
        <Stat label="Done this week" value={totals.doneThisWeek} />
        <Stat label="Notes" value={totals.notes} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskRows tasks={overdue} empty="Nothing overdue." tone="danger" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Due in the next 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskRows tasks={dueSoon} empty="Nothing due soon." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In progress</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskRows tasks={inProgress} empty="Nothing in progress." />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Projects</CardTitle>
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
            <CardTitle className="text-base">Recent notes</CardTitle>
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
