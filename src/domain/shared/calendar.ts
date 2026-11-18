const DAY_MS = 24 * 60 * 60 * 1000

/** `YYYY-MM-DD` of `date` in `timeZone` (an IANA name); the runtime's own zone when undefined. */
export const dayIn = (date: Date, timeZone?: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** The `YYYY-MM-DD` day `days` after `day`. */
export const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T12:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10)
