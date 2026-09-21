// App.tsx

import { useEffect, useState } from 'react'
import CalendarPanel from './components/CalendarPanel'
import DesmosPanel from './components/DesmosPanel'
import NotionPanel from './components/NotionPanel'
import FileBrowser from './components/FileBrowser/FileBrowser'
import QuickLinksPanel from './components/QuickLinksPanel'
import FormulasPanel from './components/FormulasPanel'
import EmailPanel from './components/EmailPanel'
import Physics1CribSheet from './components/Physics1CribSheet'
import RoboticsCribSheet from './components/RoboticsCribSheet'

type Tab = 'dashboard' | 'formulas' | 'email'
type FormulasView = 'general' | 'physics1' | 'robotics'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'formulas', label: 'Formulas' },
  { id: 'email', label: 'Email' },
]

export default function App() {
  const [now, setNow] = useState(new Date())
  const [tab, setTab] = useState<Tab>('dashboard')
  const [formulasView, setFormulasView] = useState<FormulasView>('general')

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
        <>
          <nav className="shell__nav shell__subnav" role="tablist" aria-label="Formula sets">
            {(['general', 'physics1', 'robotics'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={formulasView === v}
                className={`shell__tab${formulasView === v ? ' shell__tab--active' : ''}`}
                onClick={() => setFormulasView(v)}
              >
                {v === 'general' ? 'General' : v === 'physics1' ? 'Physics 1' : 'Robotics'}
              </button>
            ))}
          </nav>
          <main className="grid grid--single">
            {formulasView === 'general' ? (
              <FormulasPanel />
            ) : formulasView === 'physics1' ? (
              <Physics1CribSheet />
            ) : (
              <RoboticsCribSheet />
            )}
          </main>
        </>
      )}

      {tab === 'email' && (
        <main className="grid grid--single">
          <EmailPanel />
        </main>
      )}
    </div>
  )
}