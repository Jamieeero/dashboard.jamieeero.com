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

interface DateParts {
  y: number
  mo: number // 1-12
  d: number
  h: number
  mi: number
  s: number
  allDay: boolean
  utc: boolean
}

function parseIcsDateParts(raw: string): DateParts {
  const allDay = raw.length === 8
  const y = Number(raw.slice(0, 4))
  const mo = Number(raw.slice(4, 6))
  const d = Number(raw.slice(6, 8))
  if (allDay) return { y, mo, d, h: 0, mi: 0, s: 0, allDay: true, utc: false }

  return {
    y,
    mo,
    d,
    h: Number(raw.slice(9, 11)),
    mi: Number(raw.slice(11, 13)),
    s: Number(raw.slice(13, 15)),
    allDay: false,
    utc: raw.endsWith('Z'),
  }
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

function partsToIso(p: DateParts): string {
  if (p.allDay) return `${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.d)}`
  return `${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${p.utc ? 'Z' : ''}`
}

function partsToMs(p: DateParts): number {
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
}

function msToParts(ms: number, template: DateParts): DateParts {
  const d = new Date(ms)
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
    allDay: template.allDay,
    utc: template.utc,
  }
}

function parseIcsDate(raw: string): { iso: string; allDay: boolean } {
  const p = parseIcsDateParts(raw)
  return { iso: partsToIso(p), allDay: p.allDay }
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

interface RRuleParts {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  count?: number
  until?: number // ms epoch
  byDay?: number[] // weekday indices, 0=Sun
}

function parseRRule(raw: string): RRuleParts | null {
  const parts: Record<string, string> = {}
  for (const kv of raw.split(';')) {
    const [k, v] = kv.split('=')
    if (k && v) parts[k.toUpperCase()] = v
  }
  const freq = parts.FREQ as RRuleParts['freq'] | undefined
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null

  const interval = parts.INTERVAL ? parseInt(parts.INTERVAL, 10) || 1 : 1
  const count = parts.COUNT ? parseInt(parts.COUNT, 10) : undefined
  const until = parts.UNTIL ? partsToMs(parseIcsDateParts(parts.UNTIL)) : undefined
  const byDay = parts.BYDAY
    ? parts.BYDAY.split(',')
        .map((d) => WEEKDAY_INDEX[d.replace(/^[+-]?\d+/, '')])
        .filter((n) => n !== undefined)
    : undefined

  return { freq, interval, count, until, byDay }
}

// Expands a single (possibly recurring) VEVENT into concrete occurrences,
// capped so events with no COUNT/UNTIL don't loop forever.
function expandOccurrences(
  startParts: DateParts,
  rrule: RRuleParts | null,
  exdates: Set<string>,
  horizonMs: number,
  maxOccurrences = 60
): DateParts[] {
  const startMs = partsToMs(startParts)
  if (!rrule) return [startParts]

  const results: DateParts[] = []
  const cap = rrule.until ? Math.min(rrule.until, horizonMs) : horizonMs

  if (rrule.freq === 'WEEKLY') {
    const startWeekday = new Date(startMs).getUTCDay()
    const weekStartMs = startMs - startWeekday * DAY_MS
    const byDay = rrule.byDay && rrule.byDay.length ? [...rrule.byDay].sort() : [startWeekday]
    let week = 0
    let count = 0
    outer: while (true) {
      const weekBaseMs = weekStartMs + week * rrule.interval * 7 * DAY_MS
      for (const wd of byDay) {
        const occMs = weekBaseMs + wd * DAY_MS
        if (occMs < startMs) continue
        if (occMs > cap) break outer
        const occ = msToParts(occMs, startParts)
        if (!exdates.has(partsToIso(occ))) {
          results.push(occ)
          count++
        }
        if (rrule.count && count >= rrule.count) break outer
        if (results.length >= maxOccurrences) break outer
      }
      week++
      if (week > maxOccurrences * 2) break // safety net
    }
    return results
  }

  // DAILY / MONTHLY / YEARLY: step the calendar unit directly.
  let i = 0
  let count = 0
  while (true) {
    const occMs =
      rrule.freq === 'DAILY'
        ? startMs + i * rrule.interval * DAY_MS
        : rrule.freq === 'MONTHLY'
        ? Date.UTC(
            startParts.y,
            startParts.mo - 1 + i * rrule.interval,
            startParts.d,
            startParts.h,
            startParts.mi,
            startParts.s
          )
        : Date.UTC(
            startParts.y + i * rrule.interval,
            startParts.mo - 1,
            startParts.d,
            startParts.h,
            startParts.mi,
            startParts.s
          )

    if (occMs > cap) break
    const occ = msToParts(occMs, startParts)
    if (!exdates.has(partsToIso(occ))) {
      results.push(occ)
      count++
    }
    i++
    if (rrule.count && count >= rrule.count) break
    if (results.length >= maxOccurrences) break
  }
  return results
}

// Unfolds RFC 5545 line continuations, then pulls out VEVENT blocks,
// expanding any RRULE recurrence into its individual occurrences
// (within a bounded window) rather than just the first instance.
function parseIcs(text: string, horizonMs: number): ParsedEvent[] {
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
        const startParts = parseIcsDateParts(current.DTSTART)
        const endParts = current.DTEND ? parseIcsDateParts(current.DTEND) : startParts
        const durationMs = partsToMs(endParts) - partsToMs(startParts)
        const summary = current.SUMMARY ? unescapeIcsText(current.SUMMARY) : '(untitled)'
        const uid = current.UID ?? crypto.randomUUID()

        const exdates = new Set<string>()
        if (current.EXDATE) {
          for (const raw of current.EXDATE.split(',')) {
            if (raw) exdates.add(partsToIso(parseIcsDateParts(raw)))
          }
        }

        const rrule = current.RRULE ? parseRRule(current.RRULE) : null
        const occurrences = expandOccurrences(startParts, rrule, exdates, horizonMs)

        for (const occ of occurrences) {
          const occMs = partsToMs(occ)
          const endOcc = msToParts(occMs + durationMs, endParts)
          events.push({
            id: rrule ? `${uid}::${partsToIso(occ)}` : uid,
            summary,
            start: partsToIso(occ),
            end: partsToIso(endOcc),
            allDay: occ.allDay,
          })
        }
      }
      current = null
    } else if (current) {
      const idx = line.indexOf(':')
      if (idx === -1) continue
      const key = line.slice(0, idx).split(';')[0]
      const value = line.slice(idx + 1)
      // EXDATE may appear on multiple lines; accumulate rather than overwrite.
      current[key] = key === 'EXDATE' && current[key] ? `${current[key]},${value}` : value
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
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  // Only expand recurrence out to a bounded horizon — plenty for an agenda view.
  const horizonMs = startOfToday.getTime() + 120 * 24 * 60 * 60 * 1000
  const events = parseIcs(text, horizonMs)

  const upcoming = events
    .filter((e) => new Date(e.start) >= startOfToday)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 20)

  return Response.json(upcoming)
}