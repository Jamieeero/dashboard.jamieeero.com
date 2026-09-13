export interface NotionEnv {
  NOTION_TOKEN: string
}

export const NOTION_PAGE_ID = '3d648c06153680d5ae02d809dd4cd9a8'

const NOTION_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
})

interface RichTextItem {
  plain_text: string
}

export type StatusType = 'Done' | 'In-Progress' | 'Not Started'

export interface NotionRow {
  id: string
  title: string
  date: string | null
  tag: { name: string; color: string } | null
  status: StatusType
}

interface NotionProperty {
  type: string
  [key: string]: unknown
}

interface NotionPageObject {
  id: string
  properties: Record<string, NotionProperty>
}

function simplifyRow(page: NotionPageObject): NotionRow {
  let title = '(untitled)'
  let date: string | null = null
  let selectTag: { name: string; color: string } | null = null
  let statusTag: { name: string; color: string } | null = null
  let checked: boolean | null = null

  for (const key in page.properties) {
    const prop = page.properties[key]
    if (prop.type === 'title') {
      const items = (prop.title as RichTextItem[]) ?? []
      if (items.length) title = items.map((t) => t.plain_text).join('')
    } else if (prop.type === 'date') {
      const d = prop.date as { start?: string } | null
      if (d?.start) date = d.start
    } else if (prop.type === 'select') {
      const option = prop.select as { name: string; color: string } | null
      if (option) selectTag = { name: option.name, color: option.color }
    } else if (prop.type === 'status') {
      const option = prop.status as { name: string; color: string } | null
      if (option) statusTag = { name: option.name, color: option.color }
    } else if (prop.type === 'checkbox') {
      checked = prop.checkbox as boolean
    }
  }

  // Determine standard status option
  let status: StatusType = 'Not Started'
  const rawStatus = statusTag?.name ?? ''

  if (checked === true || rawStatus.toLowerCase() === 'done') {
    status = 'Done'
  } else if (rawStatus.toLowerCase().includes('progress')) {
    status = 'In-Progress'
  } else {
    status = 'Not Started'
  }

  return { id: page.id, title, date, tag: selectTag, status }
}

export async function getNotionContent(env: NotionEnv): Promise<Response> {
  const dbRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_PAGE_ID}/query`, {
    method: 'POST',
    headers: NOTION_HEADERS(env.NOTION_TOKEN),
    body: JSON.stringify({ page_size: 50 }),
  })

  if (dbRes.ok) {
    const data = await dbRes.json<{ results: NotionPageObject[] }>()
    const meta = await fetch(`https://api.notion.com/v1/databases/${NOTION_PAGE_ID}`, {
      headers: NOTION_HEADERS(env.NOTION_TOKEN),
    })
    let title = 'Notes'
    if (meta.ok) {
      const metaData = await meta.json<{ title: RichTextItem[] }>()
      if (metaData.title?.length) title = metaData.title.map((t) => t.plain_text).join('')
    }
    return Response.json({
      kind: 'database',
      title,
      rows: data.results.map(simplifyRow),
    })
  }

  const blocksRes = await fetch(
    `https://api.notion.com/v1/blocks/${NOTION_PAGE_ID}/children?page_size=100`,
    { headers: NOTION_HEADERS(env.NOTION_TOKEN) }
  )

  if (!blocksRes.ok) {
    const body = await blocksRes.text()
    return new Response(`Notion API error: ${blocksRes.status} ${body}`, { status: 502 })
  }

  const data = await blocksRes.json<{ results: NotionBlock[] }>()
  const dbBlock = data.results.find((b) => b.type === 'child_database')

  if (dbBlock) {
    const inlineDbRes = await fetch(`https://api.notion.com/v1/databases/${dbBlock.id}/query`, {
      method: 'POST',
      headers: NOTION_HEADERS(env.NOTION_TOKEN),
      body: JSON.stringify({ page_size: 50 }),
    })

    if (inlineDbRes.ok) {
      const inlineData = await inlineDbRes.json<{ results: NotionPageObject[] }>()
      const dbDetails = dbBlock.child_database as { title: string }

      return Response.json({
        kind: 'database',
        title: dbDetails.title || 'Notes',
        rows: inlineData.results.map(simplifyRow),
      })
    }
  }

  return Response.json({ kind: 'blocks', blocks: data.results })
}

import { useEffect, useRef, useState } from 'react'
import FullscreenButton from './FullscreenButton'

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

  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)

  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays === 1) return 'Tomorrow'

  if (diffDays > 1 && diffDays < 7) {
    return 'Next ' + target.toLocaleDateString('en-US', { weekday: 'long' })
  }
  if (diffDays < -1 && diffDays > -7) {
    return target.toLocaleDateString('en-US', { weekday: 'long' })
  }

  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sortRows(rows: NotionRow[]): NotionRow[] {
  const statusPriority: Record<StatusType, number> = {
    'In-Progress': 1,
    'Not Started': 2,
    'Done': 3,
  }

  return [...rows].sort((a, b) => {
    if (statusPriority[a.status] !== statusPriority[b.status]) {
      return statusPriority[a.status] - statusPriority[b.status]
    }
    if (a.date && b.date) return a.date.localeCompare(b.date)
    if (a.date !== b.date) return a.date ? -1 : 1
    return a.title.localeCompare(b.title)
  })
}

const STATUS_STYLE_MAP: Record<StatusType, { bg: string; color: string }> = {
  'Done': { bg: '#dcfce7', color: '#166534' },         // Green
  'In-Progress': { bg: '#dbeafe', color: '#1e40af' },  // Blue
  'Not Started': { bg: '#fee2e2', color: '#991b1b' },  // Red
}

function TaskRow({ row }: { row: NotionRow }) {
  const statusStyle = STATUS_STYLE_MAP[row.status]

  return (
    <li className={`notion-task${row.status === 'Done' ? ' notion-task--done' : ''}`}>
      <span className="notion-task__title" style={{ flexGrow: 1, fontWeight: 'bold' }}>
        {row.title}
      </span>

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

        {/* Status badge on the far right */}
        <span
          className="notion-task__status"
          style={{
            backgroundColor: statusStyle.bg,
            color: statusStyle.color,
            padding: '2px 10px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {row.status}
        </span>
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
          <a className="open-in-btn" href={NOTION_PAGE_URL} target="_blank" rel="noreferrer">
            open in notion ↗
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