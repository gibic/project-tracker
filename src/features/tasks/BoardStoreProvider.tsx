'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'

import type { Task } from '@/domain/tasks/task'

import { createBoardStore, type BoardStore } from './boardStore'

type BoardStoreApi = ReturnType<typeof createBoardStore>

const BoardStoreContext = createContext<BoardStoreApi | null>(null)

/** One store per mounted board, created from server data (zustand's Next.js pattern). */
export function BoardStoreProvider({
  projectId,
  tasks,
  children,
}: {
  projectId: string
  tasks: Task[]
  children: ReactNode
}) {
  const [store] = useState(() => createBoardStore(projectId, tasks))

  // Server actions revalidate the page; adopt the new server truth when it arrives.
  useEffect(() => {
    store.getState().syncFromServer(tasks)
  }, [store, tasks])

  return <BoardStoreContext value={store}>{children}</BoardStoreContext>
}

export function useBoardStoreApi(): BoardStoreApi {
  const store = useContext(BoardStoreContext)
  if (!store) throw new Error('useBoardStore must be used within BoardStoreProvider')
  return store
}

export function useBoardStore<T>(selector: (state: BoardStore) => T): T {
  return useStore(useBoardStoreApi(), selector)
}
