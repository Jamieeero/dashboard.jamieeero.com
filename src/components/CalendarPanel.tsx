import { useEffect, useRef, useState } from 'react'
import FullscreenButton from './FullscreenButton'

interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string
  allDay: boolean
}

function formatWhen(event: CalendarEvent): string {
  if (event.allDay) {
    return new Date(event.start + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }
  return new Date(event.start).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function CalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLElement>(null)

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

  return (
    <section className="panel panel--calendar" ref={panelRef}>
      <header className="panel__header">
        <h2>Calendar</h2>
        <div className="panel__header-actions">
          <span className="meta">google</span>
          <FullscreenButton targetRef={panelRef} />
        </div>
      </header>
      <div className="panel__body panel__body--padded agenda">
        {loading && <p className="notion-empty">Loading…</p>}
        {error && <p className="notion-empty">Couldn't load events: {error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className="notion-empty">Nothing coming up.</p>
        )}
        {!loading &&
          !error &&
          events.map((event) => (
            <div key={event.id} className="agenda__row">
              <span className="agenda__when">{formatWhen(event)}</span>
              <span className="agenda__title">{event.summary}</span>
            </div>
          ))}
      </div>
    </section>
  )
}
