import { useEffect, useState } from 'react'
import CalendarPanel from './components/CalendarPanel'
import DesmosPanel from './components/DesmosPanel'
import NotionPanel from './components/NotionPanel'
import FileBrowser from './components/FileBrowser/FileBrowser'
import QuickLinksPanel from './components/QuickLinksPanel'

export default function App() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="shell__title">
          jamieeero <span>/ dashboard</span>
        </h1>
        <time className="shell__clock" dateTime={now.toISOString()}>
          {now.toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </header>
      <main className="grid">
        <CalendarPanel />
        <QuickLinksPanel />
        <NotionPanel />
        <DesmosPanel />
        <FileBrowser />
      </main>
    </div>
  )
}