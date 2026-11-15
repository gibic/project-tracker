'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

import { useBoardStoreApi } from './BoardStoreProvider'

/**
 * Opens the task named by `?task=<id>` (links from the command palette), then drops the
 * parameter so closing the dialog does not reopen it and the same link works again later.
 */
export function OpenTaskFromUrl() {
  const taskId = useSearchParams().get('task')
  const store = useBoardStoreApi()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!taskId) return
    // No existence check: a task created just before navigating reaches the store in the
    // provider's sync effect, which runs after this one. The dialog shows once it is there.
    store.getState().openTask(taskId)
    router.replace(pathname, { scroll: false })
  }, [taskId, store, router, pathname])

  return null
}
