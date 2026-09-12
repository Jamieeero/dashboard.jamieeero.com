import { useEffect, useRef, useState } from 'react'
import FullscreenButton from './FullscreenButton'

interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string
  allDay: boolean
}

// Controls the vertical height of the calendar. 1.5 means 1 hour = 90px.
const PIXELS_PER_MINUTE = 1.5
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function formatHourLabel(hour: number) {
  if (hour === 0) return ''
  const ampm = hour < 12 ? 'AM' : 'PM'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h} ${ampm}`
}

export default function CalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nowMinutes, setNowMinutes] = useState(0)

  const panelRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Fetch events
  useEffect(() => {
    fetch('/api/calendar')
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then(setEvents)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  // Live "Now" line tracker
  useEffect(() => {
    const updateNow = () => {
      const now = new Date()
      setNowMinutes(now.getHours() * 60 + now.getMinutes())
    }
    updateNow() // Initial set
    const interval = setInterval(updateNow, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to current time on load
  useEffect(() => {
    if (!loading && scrollRef.current) {
      // Scroll to current time minus 2 hours for comfortable padding
      scrollRef.current.scrollTop = Math.max(0, (nowMinutes * PIXELS_PER_MINUTE) - (120 * PIXELS_PER_MINUTE))
    }
  }, [loading, nowMinutes])

  const allDayEvents = events.filter((e) => e.allDay)
  const timeEvents = events.filter((e) => !e.allDay)

  return (
    <section
      className="panel panel--calendar"
      ref={panelRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <header className="panel__header" style={{ flexShrink: 0 }}>
        <h2>Today</h2>
        <div className="panel__header-actions">
          <span className="meta">google</span>
          <FullscreenButton targetRef={panelRef} />
        </div>
      </header>

      <div className="panel__body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading && <p className="notion-empty" style={{ padding: '1rem' }}>Loading…</p>}
        {error && <p className="notion-empty" style={{ padding: '1rem' }}>Couldn't load events: {error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className="notion-empty" style={{ padding: '1rem' }}>Nothing scheduled for today.</p>
        )}

        {!loading && !error && events.length > 0 && (
          <>
            {/* All-Day Events Section (Pinned to top) */}
            {allDayEvents.length > 0 && (
              <div style={{ borderBottom: '1px solid #e0e0e0', padding: '8px 8px 8px 60px' }}>
                {allDayEvents.map(event => (
                  <div key={event.id} style={{
                    backgroundColor: '#4285F4',
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
            <div
              ref={scrollRef}
              style={{ flex: 1, position: 'relative', overflowY: 'auto', paddingBottom: '2rem' }}
            >

              {/* Background Grid Lines & Labels */}
              {HOURS.map((hour) => (
                <div key={hour} style={{
                  position: 'relative',
                  height: `${60 * PIXELS_PER_MINUTE}px`
                }}>
                  {/* Time Label */}
                  <span style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '8px',
                    fontSize: '0.75rem',
                    color: '#70757a',
                    width: '45px',
                    textAlign: 'right'
                  }}>
                    {formatHourLabel(hour)}
                  </span>
                  {/* Grid Line */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '60px',
                    right: 0,
                    borderTop: '1px solid #e0e0e0'
                  }} />
                </div>
              ))}

              {/* Red "Now" Indicator Line */}
              <div style={{
                position: 'absolute',
                top: `${nowMinutes * PIXELS_PER_MINUTE}px`,
                left: '52px', // Pulled slightly left for the circle
                right: 0,
                height: '2px',
                backgroundColor: '#EA4335',
                zIndex: 10,
                pointerEvents: 'none'
              }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '-4px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#EA4335'
                }} />
              </div>

              {/* Scheduled Events Blocks */}
              {timeEvents.map((event) => {
                const startDate = new Date(event.start)
                const endDate = new Date(event.end)

                const startMins = startDate.getHours() * 60 + startDate.getMinutes()
                const endMins = endDate.getHours() * 60 + endDate.getMinutes()

                // Handle events stretching past midnight safely for standard 1-day rendering
                const boundedStart = Math.max(0, startMins)
                const boundedEnd = endMins === 0 ? 1440 : Math.min(1440, endMins)

                const height = Math.max(15, (boundedEnd - boundedStart) * PIXELS_PER_MINUTE) // Minimum 15px height

                return (
                  <div
                    key={event.id}
                    style={{
                      position: 'absolute',
                      top: `${boundedStart * PIXELS_PER_MINUTE}px`,
                      left: '65px', // Sit just right of the timeline
                      right: '15px',
                      height: `${height}px`,
                      backgroundColor: '#4285F4',
                      color: 'white',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.85rem',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      borderLeft: '4px solid #1a73e8' // Google Calendar darker edge visual
                    }}
                  >
                    <div style={{ fontWeight: '600', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {event.summary}
                    </div>
                    {/* Only show time if the block is tall enough */}
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