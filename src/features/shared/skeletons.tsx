import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utilities/ui'

/** Loading placeholders shaped like the real page sections, used by route `loading.tsx` files. */

export function PageHeaderSkeleton({ description = true, actions = 0 }: { description?: boolean; actions?: number }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        {description && <Skeleton className="h-4 w-32" />}
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>
      )}
    </div>
  )
}

export function LineSkeletons({ count, className }: { count: number; className?: string }) {
  const widths = ['w-full', 'w-11/12', 'w-4/5', 'w-2/3', 'w-5/6', 'w-3/4']
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', widths[i % widths.length])} />
      ))}
    </div>
  )
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Card className={className} aria-hidden>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <LineSkeletons count={lines} />
      </CardContent>
    </Card>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden" aria-hidden>
      <ul className="divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
            <Skeleton className={cn('h-5', i % 2 ? 'w-56' : 'w-40')} />
            <Skeleton className="h-3 w-16" />
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Screen-reader announcement for a loading region; pair with `aria-hidden` skeletons. */
export function LoadingStatus({ label = 'Loading…' }: { label?: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  )
}
