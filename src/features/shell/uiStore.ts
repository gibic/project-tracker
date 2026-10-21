import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type ProjectView = 'board' | 'list'

interface UIState {
  /** Mobile navigation drawer. Not persisted. */
  navOpen: boolean
  /** Remembered across visits. */
  projectView: ProjectView
  setNavOpen: (open: boolean) => void
  setProjectView: (view: ProjectView) => void
}

/**
 * Global, client-only UI preferences. Never written on the server, so a module-level
 * store is safe here. `skipHydration` avoids a server/client mismatch: the persisted
 * value is loaded after mount by `<UIStoreHydrator />`.
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      navOpen: false,
      projectView: 'board',
      setNavOpen: (navOpen) => set({ navOpen }),
      setProjectView: (projectView) => set({ projectView }),
    }),
    {
      name: 'workspace-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ projectView }) => ({ projectView }),
      skipHydration: true,
    },
  ),
)
