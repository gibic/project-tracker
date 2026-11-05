import { cn } from '@/utilities/ui'
import * as React from 'react'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="skeleton" className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

export { Skeleton }
