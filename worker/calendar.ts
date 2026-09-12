export interface CalendarEnv {
  // Now accepts a comma-separated list of ICS URLs
  CALENDAR_ICS_URLS: string
}

export async function getCalendarEvents(env: CalendarEnv): Promise<Response> {
  // Split the URLs and remove any empty strings/spaces
  const urls = env.CALENDAR_ICS_URLS.split(',').map(u => u.trim()).filter(Boolean)

  if (urls.length === 0) {
    return new Response("No calendar URLs configured", { status: 500 })
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)

  const horizonMs = endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000

  // Google Calendar-style colors to assign to each feed
  const palette = ['#4285F4', '#33B679', '#D50000', '#8E24AA', '#F6BF26', '#F4511E']

  try {
    // Fetch and parse all calendars concurrently
    const fetchPromises = urls.map(async (url, index) => {
      const res = await fetch(url)
      if (!res.ok) return []

      const text = await res.text()
      const events = parseIcs(text, horizonMs)
      const color = palette[index % palette.length]

      return events
        .filter((e) => {
          const eStart = e.allDay ? new Date(`${e.start}T00:00:00`).getTime() : new Date(e.start).getTime()
          const eEnd = e.allDay ? new Date(`${e.start}T23:59:59`).getTime() : new Date(e.end).getTime()
          return eStart < endOfToday.getTime() && eEnd > startOfToday.getTime()
        })
        .map(e => ({ ...e, color })) // Inject the color into the event object
    })

    const allEventArrays = await Promise.all(fetchPromises)

    // Flatten the array of arrays and sort everything by start time
    const todaysEvents = allEventArrays
      .flat()
      .sort((a, b) => a.start.localeCompare(b.start))

    return Response.json(todaysEvents)
  } catch (err) {
    return new Response(`Calendar fetch error: ${err}`, { status: 502 })
  }
}