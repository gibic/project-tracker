import React from 'react'

import { cn } from '@/utilities/ui'

/**
 * The two heading levels below a page's h1:
 * - section heading: names a block of content (dashboard cards, board columns, task groups)
 * - meta label: small uppercase caption for supporting metadata in sidebars
 */
export const sectionHeadingClass = 'text-sm font-semibold'
export const metaLabelClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' }

export function SectionHeading({ as: Tag = 'h2', className, ...props }: HeadingProps) {
  return <Tag className={cn(sectionHeadingClass, className)} {...props} />
}

export function MetaLabel({ as: Tag = 'h2', className, ...props }: HeadingProps) {
  return <Tag className={cn(metaLabelClass, className)} {...props} />
}
