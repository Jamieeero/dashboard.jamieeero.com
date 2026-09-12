export interface NotionEnv {
  NOTION_TOKEN: string
}

// The page (or database) to display — not secret, safe to hardcode.
export const NOTION_PAGE_ID = '3d648c06153680d5ae02d809dd4cd9a8'

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

  // Prefer the 'select' tag (e.g., GameStoryTelling) over the 'status' tag (e.g., Not Started)
  const tag = selectTag || statusTag

  return { id: page.id, title, date, tag, checked }
}

export async function getNotionContent(env: NotionEnv): Promise<Response> {
  // 1. Try it as a database first
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

  // 2. Not a direct database — render it as a page's blocks instead.
  const blocksRes = await fetch(
    `https://api.notion.com/v1/blocks/${NOTION_PAGE_ID}/children?page_size=100`,
    { headers: NOTION_HEADERS(env.NOTION_TOKEN) }
  )

  if (!blocksRes.ok) {
    const body = await blocksRes.text()
    return new Response(`Notion API error: ${blocksRes.status} ${body}`, { status: 502 })
  }

  const data = await blocksRes.json<{ results: NotionBlock[] }>()

  // 3. NEW LOGIC: Look for an inline database inside this page
  const dbBlock = data.results.find((b) => b.type === 'child_database')

  if (dbBlock) {
    // We found the inline database! Use its specific ID to fetch the rows.
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

  // 4. If no database was found at all, return the standard text blocks
  return Response.json({ kind: 'blocks', blocks: data.results })
}