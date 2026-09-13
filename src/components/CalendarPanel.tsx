import { useEffect, useRef, useState } from 'react'
import FullscreenButton from './FullscreenButton'

interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string
  allDay: boolean
  color?: string
}

const PIXELS_PER_MINUTE = 1.5
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function formatHourLabel(hour: number) {
  if (hour === 0) return ''
  const ampm = hour < 12 ? 'AM' : 'PM'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h} ${ampm}`
}

// Local (not UTC) YYYY-MM-DD, matching what a <input type="date"> expects.
function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatHeaderDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function CalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nowMinutes, setNowMinutes] = useState(0)
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()))

  const panelRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isToday = selectedDate === toDateInputValue(new Date())

  function shiftDay(delta: number) {
    const d = new Date(`${selectedDate}T00:00:00`)
    d.setDate(d.getDate() + delta)
    setSelectedDate(toDateInputValue(d))
  }

  useEffect(() => {
    setLoading(true)
    fetch(`/api/calendar?date=${selectedDate}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then(setEvents)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [selectedDate])

  useEffect(() => {
    const updateNow = () => {
      const now = new Date()
      setNowMinutes(now.getHours() * 60 + now.getMinutes())
    }
    updateNow()
    const interval = setInterval(updateNow, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!loading && scrollRef.current) {
      // Center on "now" only when viewing today; otherwise start near the top.
      const scrollTarget = isToday ? Math.max(0, (nowMinutes * PIXELS_PER_MINUTE) - (120 * PIXELS_PER_MINUTE)) : 0
      scrollRef.current.scrollTop = scrollTarget
    }
  }, [loading, nowMinutes, isToday, selectedDate])

  const allDayEvents = events.filter((e) => e.allDay)
  const timeEvents = events.filter((e) => !e.allDay)

  return (
    <section
      className="panel panel--calendar"
      ref={panelRef}
      // ADDED maxHeight here to constrain the panel and force internal scrolling
      style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '560px' }}
    >
      <header className="panel__header" style={{ flexShrink: 0 }}>
        <h2>{isToday ? 'Today' : formatHeaderDate(selectedDate)}</h2>
        <div className="panel__header-actions">
          <a
            className="open-in-btn"
            href={`https://calendar.google.com/calendar/r/day/${Number(selectedDate.slice(0, 4))}/${Number(selectedDate.slice(5, 7))}/${Number(selectedDate.slice(8, 10))}`}
            target="_blank"
            rel="noreferrer"
          >
            open in calendar ↗
          </a>
          <FullscreenButton targetRef={panelRef} />
        </div>
      </header>

      <div className="calendar-nav">
        <button className="calendar-nav__btn" onClick={() => shiftDay(-1)} aria-label="Previous day">‹</button>
        <input
          type="date"
          className="calendar-nav__date"
          value={selectedDate}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
        />
        <button className="calendar-nav__btn" onClick={() => shiftDay(1)} aria-label="Next day">›</button>
        {!isToday && (
          <button className="calendar-nav__today" onClick={() => setSelectedDate(toDateInputValue(new Date()))}>
            Today
          </button>
        )}
      </div>

      <div className="panel__body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading && <p className="notion-empty" style={{ padding: '1rem' }}>Loading…</p>}
        {error && <p className="notion-empty" style={{ padding: '1rem' }}>Couldn't load events: {error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className="notion-empty" style={{ padding: '1rem' }}>Nothing scheduled for this day.</p>
        )}

        {!loading && !error && events.length > 0 && (
          <>
            {/* All-Day Events Section (Pinned to top, doesn't scroll) */}
            {allDayEvents.length > 0 && (
              <div style={{ borderBottom: '1px solid #e0e0e0', padding: '8px 8px 8px 60px', flexShrink: 0 }}>
                {allDayEvents.map(event => (
                  <div key={event.id} style={{
                    backgroundColor: event.color || '#4285F4',
                    color: 'white',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    marginBottom: '4px',
                    fontSize: '0.85rem',
                    fontWeight: '500'
                  }}>
                    {event.summary}
                  </div>
                ))}
              </div>
            )}

            {/* Scrollable Time Grid */}
            <div ref={scrollRef} style={{ flex: 1, position: 'relative', overflowY: 'auto', paddingBottom: '2rem' }}>

              {/* Background Grid Lines */}
              {HOURS.map((hour) => (
                <div key={hour} style={{ position: 'relative', height: `${60 * PIXELS_PER_MINUTE}px` }}>
                  <span style={{
                    position: 'absolute', top: '-8px', left: '8px',
                    fontSize: '0.75rem', color: '#70757a', width: '45px', textAlign: 'right'
                  }}>
                    {formatHourLabel(hour)}
                  </span>
                  <div style={{ position: 'absolute', top: 0, left: '60px', right: 0, borderTop: '1px solid #e0e0e0' }} />
                </div>
              ))}

              {/* Red "Now" Indicator Line — only meaningful when viewing today */}
              {isToday && (
                <div style={{
                  position: 'absolute', top: `${nowMinutes * PIXELS_PER_MINUTE}px`,
                  left: '52px', right: 0, height: '2px', backgroundColor: '#EA4335', zIndex: 10, pointerEvents: 'none'
                }}>
                  <div style={{
                    position: 'absolute', left: 0, top: '-4px', width: '10px', height: '10px',
                    borderRadius: '50%', backgroundColor: '#EA4335'
                  }} />
                </div>
              )}

              {/* Scheduled Events Blocks with Overlap Logic */}
              {timeEvents.map((event) => {
                const startDate = new Date(event.start)
                const endDate = new Date(event.end)
                const startMins = startDate.getHours() * 60 + startDate.getMinutes()
                const endMins = endDate.getHours() * 60 + endDate.getMinutes()

                const boundedStart = Math.max(0, startMins)
                const boundedEnd = endMins === 0 ? 1440 : Math.min(1440, endMins)
                const height = Math.max(15, (boundedEnd - boundedStart) * PIXELS_PER_MINUTE)

                const overlappingEvents = timeEvents.filter(otherEvent => {
                  const otherStart = new Date(otherEvent.start).getTime()
                  const otherEnd = new Date(otherEvent.end).getTime()
                  return otherStart < endDate.getTime() && otherEnd > startDate.getTime()
                })

                const overlapIndex = overlappingEvents.findIndex(e => e.id === event.id)
                const totalOverlaps = overlappingEvents.length

                const baseLeft = 65
                const rightPadding = 15
                const widthStyle = `calc((100% - ${baseLeft + rightPadding}px) / ${totalOverlaps})`
                const leftStyle = `calc(${baseLeft}px + ((100% - ${baseLeft + rightPadding}px) / ${totalOverlaps} * ${overlapIndex}))`

                const bgColor = event.color || '#4285F4'

                return (
                  <div
                    key={event.id}
                    style={{
                      position: 'absolute',
                      top: `${boundedStart * PIXELS_PER_MINUTE}px`,
                      left: leftStyle,
                      width: widthStyle,
                      height: `${height}px`,
                      backgroundColor: bgColor,
                      color: 'white',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.85rem',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      borderLeft: '4px solid rgba(0,0,0,0.2)',
                      borderRight: totalOverlaps > 1 ? '1px solid white' : 'none'
                    }}
                  >
                    <div style={{ fontWeight: '600', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {event.summary}
                    </div>
                    {height > 30 && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                        {startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}