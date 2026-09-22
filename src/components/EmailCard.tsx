import { useEffect, useState } from 'react'

interface FullMessage {
  subject: string
  from: string
  html: string | null
  text: string | null
}

interface EmailCardProps {
  messageId: string
  onClose: () => void
}

export default function EmailCard({ messageId, onClose }: EmailCardProps) {
  const [data, setData] = useState<FullMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    setLoading(true)
    fetch(`/api/email/message?id=${encodeURIComponent(messageId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [messageId])

  return (
    <div className="email-card">
      <div className="email-card__header">
        <div className="email-card__meta">
          {data && (
            <>
              <span className="email-card__subject">{data.subject}</span>
              <span className="email-card__from">{data.from}</span>
            </>
          )}
        </div>
        <button className="email-card__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="email-card__body">
        {loading && <p className="email-empty">Loading…</p>}
        {error && <p className="email-empty">Couldn't load this message: {error}</p>}
        {!loading && !error && data?.html && (
          <iframe className="email-card__frame" sandbox="" srcDoc={data.html} title={data.subject} />
        )}
        {!loading && !error && !data?.html && data?.text && <pre className="email-card__text">{data.text}</pre>}
        {!loading && !error && data && !data.html && !data.text && (
          <p className="email-empty">This message has no readable content.</p>
        )}
      </div>
    </div>
  )
}
