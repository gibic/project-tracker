import type { BadgeProps } from '@/components/ui/badge'
import type { TaskPriority } from '@/domain/tasks/task'

export { TASK_STATUS_LABELS } from '@/domain/tasks/task'

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const priorityBadgeVariant: Record<TaskPriority, BadgeProps['variant']> = {
  low: 'outline',
  medium: 'secondary',
  high: 'warning',
  urgent: 'destructive',
}
