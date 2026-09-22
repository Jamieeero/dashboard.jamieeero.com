import { useEffect, useState } from 'react'
import { isOverdue, type NotionRow } from './NotionPanel'

const LAST_EMAIL_CHECK_KEY = 'dashboard:email:lastChecked'

type NotionResponse =
  | { kind: 'blocks' }
  | { kind: 'database'; rows: NotionRow[] }

interface EmailMessage {
  receivedAt: string
}

interface Stat {
  label: string
  value: number
  tone: 'default' | 'warning'
}

export default function StatsBar() {
  const [stats, setStats] = useState<Stat[] | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [notionRes, emailRes] = await Promise.allSettled([
        fetch('/api/notion').then((r) => (r.ok ? (r.json() as Promise<NotionResponse>) : null)),
        fetch('/api/email').then((r) => (r.ok ? (r.json() as Promise<{ messages: EmailMessage[] }>) : null)),
      ])

      if (cancelled) return

      let overdue = 0
      let unfinished = 0
      if (notionRes.status === 'fulfilled' && notionRes.value?.kind === 'database') {
        const rows = notionRes.value.rows
        unfinished = rows.filter((r) => r.status !== 'Done').length
        overdue = rows.filter(isOverdue).length
      }

      let newEmails = 0
      if (emailRes.status === 'fulfilled' && emailRes.value) {
        const lastChecked = localStorage.getItem(LAST_EMAIL_CHECK_KEY)
        const since = lastChecked ? new Date(lastChecked).getTime() : Date.now() - 24 * 60 * 60 * 1000
        newEmails = emailRes.value.messages.filter((m) => new Date(m.receivedAt).getTime() > since).length
      }

      setStats([
        { label: 'New emails', value: newEmails, tone: newEmails > 0 ? 'warning' : 'default' },
        { label: 'Overdue', value: overdue, tone: overdue > 0 ? 'warning' : 'default' },
        { label: 'Unfinished', value: unfinished, tone: 'default' },
      ])
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <aside className="stats-bar" aria-label="At a glance">
      {(stats ?? [
        { label: 'New emails', value: 0, tone: 'default' as const },
        { label: 'Overdue', value: 0, tone: 'default' as const },
        { label: 'Unfinished', value: 0, tone: 'default' as const },
      ]).map((s) => (
        <div key={s.label} className={`stats-bar__item${s.tone === 'warning' ? ' stats-bar__item--warning' : ''}`}>
          <span className="stats-bar__value">{stats ? s.value : '–'}</span>
          <span className="stats-bar__label">{s.label}</span>
        </div>
      ))}
    </aside>
  )
}
