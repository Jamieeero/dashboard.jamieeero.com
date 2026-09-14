import { useEffect, useState } from 'react'
import CalendarPanel from './components/CalendarPanel'
import DesmosPanel from './components/DesmosPanel'
import NotionPanel from './components/NotionPanel'
import FileBrowser from './components/FileBrowser/FileBrowser'
import QuickLinksPanel from './components/QuickLinksPanel'
import FormulasPanel from './components/FormulasPanel'
import EmailPanel from './components/EmailPanel'

type Tab = 'dashboard' | 'formulas' | 'email'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'formulas', label: 'Formulas' },
  { id: 'email', label: 'Email' },
]

export default function App() {
  const [now, setNow] = useState(new Date())
  const [tab, setTab] = useState<Tab>('dashboard')

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
        <nav className="shell__nav" role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`shell__tab${tab === t.id ? ' shell__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
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

      {tab === 'dashboard' && (
        <main className="grid">
          <CalendarPanel />
          <QuickLinksPanel />
          <NotionPanel />
          <DesmosPanel />
          <FileBrowser />
        </main>
      )}

      {tab === 'formulas' && (
        <main className="grid grid--single">
          <FormulasPanel />
        </main>
      )}

      {tab === 'email' && (
        <main className="grid grid--single">
          <EmailPanel />
        </main>
      )}
    </div>
  )
}