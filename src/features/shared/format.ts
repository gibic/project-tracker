/*
 * Fixed locale and timezone so server and client render identical strings (no hydration mismatch).
 * Due dates are pinned to 12:00 UTC (see domain `parseDueDate`), so UTC shows the intended day.
 */

const dueDateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const dueDateWithYearFormat = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export const formatDueDate = (date: Date, now = new Date()): string =>
  (date.getUTCFullYear() === now.getUTCFullYear() ? dueDateFormat : dueDateWithYearFormat).format(date)

/** Value for <input type="date">. */
export const toDateInputValue = (date: Date | null): string => (date ? date.toISOString().slice(0, 10) : '')

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "3 days ago" style label. Use in server components only; it depends on the current time. */
export const formatRelative = (date: Date, now = new Date()): string => {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}
