// Google Calendar → Settings → "Integrate calendar" → copy the
// "Embed code" src URL and paste it below. No auth required for
// a read-only view of your own calendar.
const CALENDAR_EMBED_SRC =
  'https://calendar.google.com/calendar/embed?src=82abb81e3310885564e96a135e9b831624cada41c5033e4a915b350e7e40b2af%40group.calendar.google.com&ctz=America%2FNew_York'

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
