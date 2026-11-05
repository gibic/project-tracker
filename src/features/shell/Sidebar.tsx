'use client'

import { FolderKanbanIcon, LayoutDashboardIcon, LogOutIcon, MenuIcon, NotebookPenIcon, SettingsIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, use, useEffect } from 'react'

import type { Project } from '@/domain/projects/project'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { cn } from '@/utilities/ui'
import { logoutAction } from '../auth/actions'
import { projectDotClass } from '../projects/colors'
import { MetaLabel } from '../shared/headings'
import { useUIStore } from './uiStore'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/notes', label: 'Notes', icon: NotebookPenIcon },
  { href: '/projects', label: 'Projects', icon: FolderKanbanIcon },
]

type SidebarProject = Pick<Project, 'id' | 'name' | 'color'>

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

/**
 * A project page highlights its own entry in the project list, so the Projects nav item
 * only gets the lighter "ancestor" state there (one highlighted item at a time).
 */
const navState = (pathname: string, href: string): 'active' | 'ancestor' | 'none' => {
  if (!isActive(pathname, href)) return 'none'
  return href === '/projects' && pathname !== href ? 'ancestor' : 'active'
}

const linkClass = (state: 'active' | 'ancestor' | 'none') =>
  cn(
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
    state === 'active'
      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      : state === 'ancestor'
        ? 'font-medium text-sidebar-foreground hover:bg-sidebar-accent'
        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  )

function ProjectLinks({ projects, pathname }: { projects: Promise<SidebarProject[]>; pathname: string }) {
  const list = use(projects)
  if (list.length === 0) return <p className="px-2 py-1 text-sm text-muted-foreground">None yet.</p>
  return list.map((project) => (
    <Link key={project.id} href={`/projects/${project.id}`} className={linkClass(pathname === `/projects/${project.id}` ? 'active' : 'none')}>
      <span className={cn('size-2 shrink-0 rounded-full', projectDotClass[project.color])} />
      <span className="truncate">{project.name}</span>
    </Link>
  ))
}

function ProjectLinksSkeleton() {
  return (
    <div className="flex flex-col gap-0.5" aria-hidden>
      {['w-32', 'w-24', 'w-28'].map((width) => (
        <div key={width} className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="size-2 rounded-full" />
          <Skeleton className={cn('h-4', width)} />
        </div>
      ))}
    </div>
  )
}

export function Sidebar({ projects, userLabel }: { projects: Promise<SidebarProject[]>; userLabel: string }) {
  const pathname = usePathname()
  const navOpen = useUIStore((s) => s.navOpen)
  const setNavOpen = useUIStore((s) => s.setNavOpen)

  // Persisted preferences load after mount to keep SSR and first client render identical.
  useEffect(() => {
    void useUIStore.persist.rehydrate()
  }, [])

  useEffect(() => setNavOpen(false), [pathname, setNavOpen])

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4 md:hidden">
        <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
          <MenuIcon />
        </Button>
        <span className="font-semibold">Workspace</span>
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" aria-hidden onClick={() => setNavOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight">
            Workspace
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Close navigation" onClick={() => setNavOpen(false)}>
            <XIcon />
          </Button>
        </div>

        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(navState(pathname, href))}>
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-2">
          <MetaLabel as="h2" className="px-2 pb-1">Active projects</MetaLabel>
          <Suspense fallback={<ProjectLinksSkeleton />}>
            <ProjectLinks projects={projects} pathname={pathname} />
          </Suspense>
        </div>

        <div className="border-t p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="truncate text-sm text-muted-foreground" title={userLabel}>
              {userLabel}
            </span>
            <ThemeSelector />
          </div>
          <Link href="/admin" prefetch={false} className={linkClass('none')}>
            <SettingsIcon className="size-4" />
            Admin panel
          </Link>
          <form action={logoutAction}>
            <button type="submit" className={cn(linkClass('none'), 'w-full')}>
              <LogOutIcon className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
