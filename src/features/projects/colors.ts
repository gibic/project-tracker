import type { ProjectColor } from '@/domain/projects/project'

// Full class names so Tailwind can find them at build time.
export const projectDotClass: Record<ProjectColor, string> = {
  slate: 'bg-slate-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
}
