import type { TaskPriority } from '@/domain/tasks/task'

import { Badge } from '@/components/ui/badge'
import { PRIORITY_LABELS, priorityBadgeVariant } from '../labels'

/** Only high and urgent get a badge; a badge on every task would stop signalling anything. */
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority !== 'high' && priority !== 'urgent') return null
  return <Badge variant={priorityBadgeVariant[priority]}>{PRIORITY_LABELS[priority]}</Badge>
}
