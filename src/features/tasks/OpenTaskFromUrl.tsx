'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

import { useBoardStoreApi } from './BoardStoreProvider'

/**
 * Opens the task named by `?task=<id>` (links from the command palette), then drops the
 * parameter so closing the dialog does not reopen it and the same link works again later.
 */
export function OpenTaskFromUrl() {
  const searchParams = useSearchParams()
  const taskId = searchParams.get('task')
  const store = useBoardStoreApi()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!taskId) return
    // No existence check: a task created just before navigating reaches the store in the
    // provider's sync effect, which runs after this one. The dialog shows once it is there.
    store.getState().openTask(taskId)
    // Keep other parameters: `done=all` must survive, or an old done task would drop off the board.
    const rest = new URLSearchParams(searchParams)
    rest.delete('task')
    const query = rest.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [taskId, searchParams, store, router, pathname])

  return null
}
