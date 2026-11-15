import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type ProjectView = 'board' | 'list'

interface UIState {
  /** Mobile navigation drawer. Not persisted. */
  navOpen: boolean
  /** Command palette (⌘K). Not persisted. */
  paletteOpen: boolean
  /** Remembered across visits. */
  projectView: ProjectView
  setNavOpen: (open: boolean) => void
  setPaletteOpen: (open: boolean) => void
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
      paletteOpen: false,
      projectView: 'board',
      setNavOpen: (navOpen) => set({ navOpen }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
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
