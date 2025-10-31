import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'

/**
 * Formats a date to "Month DD, YYYY" format
 * Example: "October 31, 2025"
 */
export function formatLongDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'MMMM dd, yyyy')
}

/**
 * Formats a date to "Month DD, YYYY at HH:MM AM/PM" format
 * Example: "October 31, 2025 at 2:30 PM"
 */
export function formatLongDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'MMMM dd, yyyy \'at\' h:mm a')
}

/**
 * Formats a date to a relative time string
 * Example: "2 hours ago", "3 days ago"
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(dateObj, { addSuffix: true })
}

/**
 * Formats a date for chat messages
 * - Today: "HH:MM AM/PM"
 * - Yesterday: "Yesterday at HH:MM AM/PM"
 * - Older: "Month DD at HH:MM AM/PM"
 */
export function formatChatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  if (isToday(dateObj)) {
    return format(dateObj, 'h:mm a')
  }

  if (isYesterday(dateObj)) {
    return format(dateObj, '\'Yesterday at\' h:mm a')
  }

  return format(dateObj, 'MMM dd \'at\' h:mm a')
}

/**
 * Formats a date for match timestamps
 * - Today: "Matched today at HH:MM AM/PM"
 * - Yesterday: "Matched yesterday at HH:MM AM/PM"
 * - This week: "Matched on Day at HH:MM AM/PM" (e.g., "Matched on Monday at 2:30 PM")
 * - Older: "Matched on Month DD, YYYY"
 */
export function formatMatchDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  if (isToday(dateObj)) {
    return format(dateObj, '\'Matched today at\' h:mm a')
  }

  if (isYesterday(dateObj)) {
    return format(dateObj, '\'Matched yesterday at\' h:mm a')
  }

  const now = new Date()
  const daysDiff = Math.floor(
    (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysDiff < 7) {
    return format(dateObj, '\'Matched on\' EEEE \'at\' h:mm a')
  }

  return format(dateObj, '\'Matched on\' MMMM dd, yyyy')
}
