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

interface NotionBlock {
  id: string
  type: string
  [key: string]: unknown
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