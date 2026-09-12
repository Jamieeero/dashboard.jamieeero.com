export interface NotionEnv {
  NOTION_TOKEN: string
}

// The page (or database) to display — not secret, safe to hardcode.
export const NOTION_PAGE_ID = '3d648c06-1536-80d5-ae02-d809dd4cd9a8'

const NOTION_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
})

interface RichTextItem {
  plain_text: string
}

interface NotionRow {
  id: string
  title: string
  date: string | null
  tag: { name: string; color: string } | null
  checked: boolean | null
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
  let tag: { name: string; color: string } | null = null
  let checked: boolean | null = null

  for (const key in page.properties) {
    const prop = page.properties[key]
    if (prop.type === 'title') {
      const items = (prop.title as RichTextItem[]) ?? []
      if (items.length) title = items.map((t) => t.plain_text).join('')
    } else if (prop.type === 'date') {
      const d = prop.date as { start?: string } | null
      if (d?.start) date = d.start
    } else if (prop.type === 'select' || prop.type === 'status') {
      const option = prop[prop.type] as { name: string; color: string } | null
      if (option) tag = { name: option.name, color: option.color }
    } else if (prop.type === 'checkbox') {
      checked = prop.checkbox as boolean
    }
  }

  return { id: page.id, title, date, tag, checked }
}

export async function getNotionContent(env: NotionEnv): Promise<Response> {
  // Try it as a database first (this is what a Notion "table" page like a
  // task list actually is under the hood).
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

  // Not a database — render it as a normal block-based page instead.
  const blocksRes = await fetch(
    `https://api.notion.com/v1/blocks/${NOTION_PAGE_ID}/children?page_size=100`,
    { headers: NOTION_HEADERS(env.NOTION_TOKEN) }
  )

  if (!blocksRes.ok) {
    const body = await blocksRes.text()
    return new Response(`Notion API error: ${blocksRes.status} ${body}`, { status: 502 })
  }

  const data = await blocksRes.json<{ results: unknown[] }>()
  return Response.json({ kind: 'blocks', blocks: data.results })
}