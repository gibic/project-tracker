import type { ProjectColor } from '@/domain/projects/project'
import type { Completion } from '@/domain/tasks/progress'

import { cn } from '@/utilities/ui'
import { projectDotClass } from './colors'

/** `compact` drops the "done" suffix for tight spots such as board cards ("3/5"). */
export function ProgressBar({
  progress,
  color,
  compact = false,
  label,
}: {
  progress: Completion
  color: ProjectColor
  compact?: boolean
  /** Accessible name, e.g. "Checklist progress". */
  label?: string
}) {
  return (
    <div className={cn('flex items-center', compact ? 'gap-2' : 'gap-3')}>
      <div
        className={cn('flex-1 overflow-hidden rounded-full bg-muted', compact ? 'h-1' : 'h-1.5')}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-valuetext={`${progress.done} of ${progress.total} done`}
      >
        <div className={cn('h-full rounded-full', projectDotClass[color])} style={{ width: `${progress.percent}%` }} />
      </div>
      <span
        className={cn('text-right text-xs tabular-nums text-muted-foreground', compact ? 'shrink-0' : 'w-20')}
      >
        {progress.done}/{progress.total}
        {!compact && ' done'}
      </span>
    </div>
  )
}
