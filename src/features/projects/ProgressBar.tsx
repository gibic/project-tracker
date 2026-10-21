import type { ProjectColor } from '@/domain/projects/project'
import type { Progress } from '@/domain/tasks/progress'

import { cn } from '@/utilities/ui'
import { projectDotClass } from './colors'

export function ProgressBar({ progress, color }: { progress: Progress; color: ProjectColor }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
      >
        <div className={cn('h-full rounded-full', projectDotClass[color])} style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
        {progress.done}/{progress.total} done
      </span>
    </div>
  )
}
