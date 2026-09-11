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
      return null // unsupported block types (images, embeds, tables, etc.) are skipped for now
  }
}

export default function NotionPanel() {
  const [blocks, setBlocks] = useState<NotionBlock[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    fetch('/api/notion')
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then(setBlocks)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

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
        {!loading && !error && blocks.map((b) => <Block key={b.id} block={b} />)}
      </div>
    </section>
  )
}
