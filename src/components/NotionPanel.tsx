import { useEffect, useRef, useState } from 'react'
import FullscreenButton from './FullscreenButton'

// Public share link, used only for the "Open in Notion" button.
const NOTION_PAGE_URL = 'https://app.notion.com/p/Homework-3d648c06153680d5ae02d809dd4cd9a8'

interface RichText {
  plain_text: string
  annotations?: { bold?: boolean; italic?: boolean; strikethrough?: boolean; code?: boolean }
  href?: string | null
}

interface NotionBlock {
  id: string
  type: string
  [key: string]: unknown
}

interface NotionRow {
  id: string
  title: string
  date: string | null
  tag: { name: string; color: string } | null
  checked: boolean | null
}

type NotionResponse =
  | { kind: 'blocks'; blocks: NotionBlock[] }
  | { kind: 'database'; title: string; rows: NotionRow[] }

function RichTextRun({ items }: { items: RichText[] }) {
  return (
    <>
      {items.map((t, i) => {
        let node: React.ReactNode = t.plain_text
        if (t.annotations?.code) node = <code key={i}>{node}</code>
        if (t.annotations?.bold) node = <strong key={i}>{node}</strong>
        if (t.annotations?.italic) node = <em key={i}>{node}</em>
        if (t.annotations?.strikethrough) node = <s key={i}>{node}</s>
        if (t.href) node = <a key={i} href={t.href} target="_blank" rel="noreferrer">{node}</a>
        return <span key={i}>{node}</span>
      })}
    </>
  )
}

function Block({ block }: { block: NotionBlock }) {
  const data = block[block.type] as { rich_text?: RichText[]; checked?: boolean } | undefined
  const text = data?.rich_text ?? []

  switch (block.type) {
    case 'heading_1':
      return <h3 className="notion-block notion-h1"><RichTextRun items={text} /></h3>
    case 'heading_2':
      return <h4 className="notion-block notion-h2"><RichTextRun items={text} /></h4>
    case 'heading_3':
      return <h5 className="notion-block notion-h3"><RichTextRun items={text} /></h5>
    case 'bulleted_list_item':
      return <li className="notion-block"><RichTextRun items={text} /></li>
    case 'numbered_list_item':
      return <li className="notion-block"><RichTextRun items={text} /></li>
    case 'to_do':
      return (
        <li className="notion-block notion-todo">
          <input type="checkbox" checked={!!data?.checked} readOnly />
          <RichTextRun items={text} />
        </li>
      )
    case 'quote':
      return <blockquote className="notion-block"><RichTextRun items={text} /></blockquote>
    case 'divider':
      return <hr className="notion-block" />
    case 'paragraph':
      if (text.length === 0) return <p className="notion-block notion-empty">&nbsp;</p>
      return <p className="notion-block"><RichTextRun items={text} /></p>
    default:
      // Temporarily render the unsupported block type to the screen
      return (
        <div className="notion-block" style={{ color: 'red', fontSize: '12px' }}>
          [Unsupported block: {block.type}]
        </div>
      )
  }
}

function formatRelativeDate(dateString: string): string {
  const target = new Date(dateString + (dateString.length === 10 ? 'T00:00:00' : ''))
  const today = new Date()

  // Normalize both dates to midnight for accurate day-math
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)

  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays === 1) return 'Tomorrow'

  // Within the next week
  if (diffDays > 1 && diffDays < 7) {
    return 'Next ' + target.toLocaleDateString('en-US', { weekday: 'long' })
  }
  // Within the past week
  if (diffDays < -1 && diffDays > -7) {
    return target.toLocaleDateString('en-US', { weekday: 'long' })
  }

  // Fallback for older/future dates
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sortRows(rows: NotionRow[]): NotionRow[] {
  return [...rows].sort((a, b) => {
    // Unchecked tasks first, then by date (undated last), then title.
    if (!!a.checked !== !!b.checked) return a.checked ? 1 : -1
    if (a.date && b.date) return a.date.localeCompare(b.date)
    if (a.date !== b.date) return a.date ? -1 : 1
    return a.title.localeCompare(b.title)
  })
}

function TaskRow({ row }: { row: NotionRow }) {
  return (
    <li className={`notion-task${row.checked ? ' notion-task--done' : ''}`}>
      {/* Title on the far left */}
      <span className="notion-task__title" style={{ flexGrow: 1, fontWeight: 'bold' }}>
        {row.title}
      </span>

      {/* Container for the right-side elements */}
      <div className="notion-task__meta" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {row.date && (
          <span className="notion-task__date">
            {formatRelativeDate(row.date)}
          </span>
        )}

        {row.tag && (
          <span className={`notion-tag notion-tag--${row.tag.color}`}>
            {row.tag.name}
          </span>
        )}

        {/* Checkbox on the far right */}
        <input type="checkbox" checked={!!row.checked} readOnly />
      </div>
    </li>
  )
}

export default function NotionPanel() {
  const [data, setData] = useState<NotionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    fetch('/api/notion')
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const isEmpty =
    !!data && ((data.kind === 'blocks' && data.blocks.length === 0) ||
      (data.kind === 'database' && data.rows.length === 0))

  return (
    <section className="panel panel--notion" ref={panelRef}>
      <header className="panel__header">
        <h2>Notes</h2>
        <div className="panel__header-actions">
          <a className="meta" href={NOTION_PAGE_URL} target="_blank" rel="noreferrer">
            open in notion →
          </a>
          <FullscreenButton targetRef={panelRef} />
        </div>
      </header>
      <div className="panel__body panel__body--padded notion-content">
        {loading && <p className="notion-empty">Loading…</p>}
        {error && <p className="notion-empty">Couldn't load the page: {error}</p>}
        {!loading && !error && isEmpty && <p className="notion-empty">Nothing here yet.</p>}
        {!loading && !error && data?.kind === 'blocks' &&
          data.blocks.map((b) => <Block key={b.id} block={b} />)}
        {!loading && !error && data?.kind === 'database' && (
          <ul className="notion-tasklist">
            {sortRows(data.rows).map((row) => (
              <TaskRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}