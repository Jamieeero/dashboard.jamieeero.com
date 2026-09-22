import { useEffect, useMemo, useState } from 'react'
import EmailCard from './EmailCard'

type Provider = 'google' | 'microsoft'

interface AccountSummary {
  id: string
  provider: Provider
  label: string
  emailAddress: string
  connectedAt: string
  openUrl: string
  error: string | null
}

interface EmailMessage {
  id: string
  accountId: string
  provider: Provider
  sender: string
  subject: string
  preview: string
  receivedAt: string
  viewed: boolean
}

interface InboxResponse {
  accounts: AccountSummary[]
  messages: EmailMessage[]
}

const LAST_EMAIL_CHECK_KEY = 'dashboard:email:lastChecked'

function formatTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function EmailRow({
  message,
  active,
  onOpen,
  onDismiss,
}: {
  message: EmailMessage
  active: boolean
  onOpen: () => void
  onDismiss?: () => void
}) {
  return (
    <li className={`email-row${active ? ' email-row--active' : ''}`}>
      <div
        className="email-row__main"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpen()
        }}
      >
        <span className="email-row__sender">{message.sender}</span>
        <span className="email-row__subject">{message.subject}</span>
        <span className="email-row__preview">{message.preview || '(no preview)'}</span>
      </div>
      <div className="email-row__side">
        <span className="email-row__time">{formatTime(message.receivedAt)}</span>
        {onDismiss && (
          <button
            className="email-row__dismiss"
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </li>
  )
}

function AccountBox({
  account,
  messages,
  expanded,
  onToggleExpand,
  openMessageId,
  onOpen,
  onDismiss,
  onDisconnect,
}: {
  account: AccountSummary
  messages: EmailMessage[]
  expanded: boolean
  onToggleExpand: () => void
  openMessageId: string | null
  onOpen: (id: string) => void
  onDismiss: (id: string) => void
  onDisconnect: (id: string) => void
}) {
  const unviewed = messages.filter((m) => !m.viewed)
  const seen = messages.filter((m) => m.viewed)

  return (
    <div className="email-account">
      <div className="email-account__header">
        <button
          className="email-account__toggle"
          onClick={onToggleExpand}
          aria-expanded={expanded}
        >
          <span className={`email-account__chevron${expanded ? ' email-account__chevron--open' : ''}`}>▸</span>
          <span className="email-account__label">{account.label}</span>
          <span className="email-account__address">{account.emailAddress}</span>
          {unviewed.length > 0 && <span className="email-account__count">{unviewed.length}</span>}
        </button>
        <div className="email-account__actions">
          <a className="open-in-btn" href={account.openUrl} target="_blank" rel="noreferrer">
            open in {account.provider === 'google' ? 'Gmail' : 'Outlook'} ↗
          </a>
          <button
            className="email-account__disconnect"
            onClick={() => onDisconnect(account.id)}
            title="Disconnect this account"
            aria-label="Disconnect this account"
          >
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <div className="email-account__body">
          {account.error && <p className="email-empty">Couldn't load this inbox: {account.error}</p>}
          {!account.error && unviewed.length === 0 && seen.length === 0 && (
            <p className="email-empty">No mail from the last 7 days.</p>
          )}
          {unviewed.length > 0 && (
            <ul className="email-list">
              {unviewed.map((m) => (
                <EmailRow
                  key={m.id}
                  message={m}
                  active={openMessageId === m.id}
                  onOpen={() => onOpen(m.id)}
                  onDismiss={() => onDismiss(m.id)}
                />
              ))}
            </ul>
          )}
          {seen.length > 0 && (
            <details className="email-seen">
              <summary>Seen, last 7 days ({seen.length})</summary>
              <ul className="email-list">
                {seen.map((m) => (
                  <EmailRow key={m.id} message={m} active={openMessageId === m.id} onOpen={() => onOpen(m.id)} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

export default function EmailPanel() {
  const [data, setData] = useState<InboxResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [openMessageId, setOpenMessageId] = useState<string | null>(null)
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({})

  function load() {
    setLoading(true)
    fetch('/api/email')
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json() as Promise<InboxResponse>
      })
      .then((res) => {
        setData(res)
        setError(null)
        // Landing on this tab counts as "checking" email — the dashboard's
        // "new since last login" stat measures from this moment forward.
        localStorage.setItem(LAST_EMAIL_CHECK_KEY, new Date().toISOString())
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('emailError')
    if (err) {
      setOauthError(err)
      window.history.replaceState({}, '', window.location.pathname)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const messagesByAccount = useMemo(() => {
    const map = new Map<string, EmailMessage[]>()
    for (const m of data?.messages ?? []) {
      const arr = map.get(m.accountId) ?? []
      arr.push(m)
      map.set(m.accountId, arr)
    }
    return map
  }, [data])

  function markSeen(id: string) {
    setData((prev) =>
      prev ? { ...prev, messages: prev.messages.map((m) => (m.id === id ? { ...m, viewed: true } : m)) } : prev
    )
    fetch('/api/email/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  function openMessage(id: string) {
    setOpenMessageId(id)
    const msg = data?.messages.find((m) => m.id === id)
    if (msg && !msg.viewed) markSeen(id)
  }

  function dismissMessage(id: string) {
    markSeen(id)
    if (openMessageId === id) setOpenMessageId(null)
  }

  async function disconnectAccount(id: string) {
    if (!confirm('Disconnect this account? You can reconnect it any time.')) return
    await fetch(`/api/email/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
    if (openMessageId?.startsWith(`${id}:`)) setOpenMessageId(null)
    load()
  }

  function connect(provider: Provider) {
    const gmailCount = data?.accounts.filter((a) => a.provider === 'google').length ?? 0
    const label = provider === 'microsoft' ? 'Outlook' : `Gmail ${gmailCount + 1}`
    window.location.href = `/api/email/connect/${provider}?label=${encodeURIComponent(label)}`
  }

  const hasOutlook = data?.accounts.some((a) => a.provider === 'microsoft') ?? false
  const cardOpen = openMessageId !== null

  return (
    <section className="panel panel--email">
      <header className="panel__header">
        <h2>Email</h2>
        <div className="panel__header-actions">
          {!hasOutlook && (
            <button className="open-in-btn" onClick={() => connect('microsoft')}>
              + Connect Outlook
            </button>
          )}
          <button className="open-in-btn" onClick={() => connect('google')}>
            + Add Gmail
          </button>
        </div>
      </header>

      <div className="panel__body panel__body--padded email__body">
        {oauthError && <p className="email-empty email-empty--error">Couldn't connect that account: {oauthError}</p>}
        {loading && !data && <p className="email-empty">Loading…</p>}
        {error && <p className="email-empty email-empty--error">Couldn't load your inboxes: {error}</p>}

        {!loading && !error && data && data.accounts.length === 0 && (
          <p className="email-empty">
            No accounts connected yet. Use "Connect Outlook" or "Add Gmail" above to see mail here without logging
            into either separately.
          </p>
        )}

        {data && data.accounts.length > 0 && (
          <div className={`email-layout${cardOpen ? ' email-layout--split' : ''}`}>
            <div className="email-list-col">
              {data.accounts.map((account) => (
                <AccountBox
                  key={account.id}
                  account={account}
                  messages={messagesByAccount.get(account.id) ?? []}
                  expanded={expandedAccounts[account.id] ?? true}
                  onToggleExpand={() =>
                    setExpandedAccounts((prev) => ({ ...prev, [account.id]: !(prev[account.id] ?? true) }))
                  }
                  openMessageId={openMessageId}
                  onOpen={openMessage}
                  onDismiss={dismissMessage}
                  onDisconnect={disconnectAccount}
                />
              ))}
            </div>
            <div className="email-card-col">
              {openMessageId && <EmailCard messageId={openMessageId} onClose={() => setOpenMessageId(null)} />}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
