'use client'

import Link from 'next/link'

import { useBoardStore } from '../BoardStoreProvider'

/** Under the done tasks when the server sent only the newest ones. */
export function HiddenDoneNotice({ count }: { count: number }) {
  const projectId = useBoardStore((s) => s.projectId)
  if (count <= 0) return null
  return (
    <p className="px-1 py-2 text-center text-xs text-muted-foreground">
      {count} older done {count === 1 ? 'task' : 'tasks'} hidden ·{' '}
      <Link href={`/projects/${projectId}?done=all`} scroll={false} className="underline hover:text-foreground">
        Show all
      </Link>
    </p>
  )
}
