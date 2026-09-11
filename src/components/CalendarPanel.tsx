// Google Calendar → Settings → "Integrate calendar" → copy the
// "Embed code" src URL and paste it below. No auth required for
// a read-only view of your own calendar.
const CALENDAR_EMBED_SRC =
  'https://calendar.google.com/calendar/embed?src=YOUR_CALENDAR_ID%40group.calendar.google.com&ctz=America%2FNew_York'

export default function CalendarPanel() {
  return (
    <section className="panel panel--calendar">
      <header className="panel__header">
        <h2>Calendar</h2>
        <span className="meta">google</span>
      </header>
      <div className="panel__body">
        <iframe src={CALENDAR_EMBED_SRC} title="Google Calendar" loading="lazy" />
      </div>
    </section>
  )
}
