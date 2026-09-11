export interface CalendarEnv {
  // The "Secret address in iCal format" from Calendar → Settings →
  // Integrate calendar. Grants read access via its own token, so it's
  // set as a Worker secret rather than hardcoded.
  CALENDAR_ICS_URL: string
}

interface ParsedEvent {
  id: string
  summary: string
  start: string // ISO date or date-time
  end: string
  allDay: boolean
}

function unescapeIcsText(s: string): string {
  return s.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

function parseIcsDate(raw: string): { iso: string; allDay: boolean } {
  const allDay = raw.length === 8
  const y = raw.slice(0, 4)
  const mo = raw.slice(4, 6)
  const d = raw.slice(6, 8)
  if (allDay) return { iso: `${y}-${mo}-${d}`, allDay: true }

  const h = raw.slice(9, 11)
  const mi = raw.slice(11, 13)
  const s = raw.slice(13, 15)
  const isUtc = raw.endsWith('Z')
  return { iso: `${y}-${mo}-${d}T${h}:${mi}:${s}${isUtc ? 'Z' : ''}`, allDay: false }
}

// Unfolds RFC 5545 line continuations, then pulls out VEVENT blocks.
// Note: recurring events (RRULE) are read at their original DTSTART only —
// this doesn't expand recurrence into future occurrences yet.
function parseIcs(text: string): ParsedEvent[] {
  const rawLines = text.split(/\r\n|\n|\r/)
  const lines: string[] = []
  for (const line of rawLines) {
    if (line.startsWith(' ') && lines.length) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }

  const events: ParsedEvent[] = []
  let current: Record<string, string> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
    } else if (line === 'END:VEVENT') {
      if (current?.DTSTART) {
        const start = parseIcsDate(current.DTSTART)
        const end = current.DTEND ? parseIcsDate(current.DTEND) : start
        events.push({
          id: current.UID ?? crypto.randomUUID(),
          summary: current.SUMMARY ? unescapeIcsText(current.SUMMARY) : '(untitled)',
          start: start.iso,
          end: end.iso,
          allDay: start.allDay,
        })
      }
      current = null
    } else if (current) {
      const idx = line.indexOf(':')
      if (idx === -1) continue
      const key = line.slice(0, idx).split(';')[0]
      current[key] = line.slice(idx + 1)
    }
  }

  return events
}

export async function getCalendarEvents(env: CalendarEnv): Promise<Response> {
  const res = await fetch(env.CALENDAR_ICS_URL)
  if (!res.ok) {
    return new Response(`Calendar fetch error: ${res.status}`, { status: 502 })
  }

  const text = await res.text()
  const events = parseIcs(text)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const upcoming = events
    .filter((e) => new Date(e.start) >= startOfToday)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 15)

  return Response.json(upcoming)
}
