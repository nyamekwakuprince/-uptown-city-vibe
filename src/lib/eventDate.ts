const eventDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Accra',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export type EventDayStatus = 'upcoming' | 'today' | 'past'

function eventDateKey(value: Date) {
  const parts = eventDateFormatter.formatToParts(value)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

export function getEventDayStatus(startDatetime: string, now = new Date()): EventDayStatus {
  const eventDate = eventDateKey(new Date(startDatetime))
  const today = eventDateKey(now)
  if (eventDate < today) return 'past'
  if (eventDate > today) return 'upcoming'
  return 'today'
}
