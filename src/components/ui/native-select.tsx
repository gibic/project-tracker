import { cn } from '@/utilities/ui'
import * as React from 'react'

/** Plain <select> styled like `Input`; works with FormData and server actions without extra state. */
const NativeSelect: React.FC<React.ComponentProps<'select'>> = ({ className, ...props }) => (
  <select
    data-slot="native-select"
    className={cn(
      'border-input ring-ring/10 dark:ring-ring/20 outline-ring/50 flex h-9 w-full min-w-0 rounded-md border bg-background px-3 py-1 text-base shadow-xs transition-[color,box-shadow] focus-visible:ring-4 focus-visible:outline-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
      className,
    )}
    {...props}
  />
)

export { NativeSelect }
