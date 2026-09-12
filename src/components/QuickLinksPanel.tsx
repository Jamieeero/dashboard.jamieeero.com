import { useEffect, useState } from 'react'

interface QuickLink {
  id: string
  label: string
  url: string
}

const STORAGE_KEY = 'jamieeero-dashboard-quicklinks'

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function loadLinks(): QuickLink[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export default function QuickLinksPanel() {
  const [links, setLinks] = useState<QuickLink[]>(() => loadLinks())
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links))
  }, [links])

  function addLink(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || !url.trim()) return
    setLinks((prev) => [...prev, { id: crypto.randomUUID(), label: label.trim(), url: normalizeUrl(url.trim()) }])
    setLabel('')
    setUrl('')
    setAdding(false)
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id))
  }

  return (
    <section className="panel panel--quicklinks">
      <header className="panel__header">
        <h2>Quick Links</h2>
        <div className="panel__header-actions">
          <button
            className="fullscreen-btn"
            onClick={() => setAdding((v) => !v)}
            aria-label={adding ? 'Cancel' : 'Add link'}
            title={adding ? 'Cancel' : 'Add link'}
          >
            {adding ? '×' : '+'}
          </button>
        </div>
      </header>

      <div className="panel__body panel__body--padded quicklinks__body">
        {adding && (
          <form className="quicklinks__form" onSubmit={addLink}>
            <input
              type="text"
              placeholder="Name (e.g. Discord)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
            <input
              type="text"
              placeholder="URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button type="submit" className="quicklinks__add-submit">Add</button>
          </form>
        )}

        {links.length === 0 && !adding && (
          <p className="notion-empty">No quick links yet. Tap + to add one.</p>
        )}

        <div className="quicklinks__list">
          {links.map((link) => (
            <div key={link.id} className="quicklinks__item">
              <a
                className="quicklinks__link"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
              <button
                className="quicklinks__remove"
                onClick={() => removeLink(link.id)}
                aria-label={`Remove ${link.label}`}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}