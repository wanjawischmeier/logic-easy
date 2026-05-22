/**
 * Formats a timestamp into a human-readable relative time string
 * Examples: "Just now", "5 minutes ago", "2 days ago", "1/15/2025"
 */
export function formatDate(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`

  // For older dates, show the actual date
  const date = new Date(timestamp)
  return date.toLocaleDateString()
}
