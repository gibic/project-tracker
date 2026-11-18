/**
 * The user's time zone, e.g. `Asia/Jakarta`. Decides which calendar day is "today" for
 * overdue / due-soon and recurrence. `NEXT_PUBLIC_` so the browser uses the same zone as the server.
 */
export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || undefined
