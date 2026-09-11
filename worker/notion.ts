export interface NotionEnv {
  NOTION_TOKEN: string
}

// The page to display — not secret, safe to hardcode.
export const NOTION_PAGE_ID = 'ebd3d648c06153680d5ae02d809dd4cd9a8' // no dashes

interface NotionBlock {
  id: string
  type: string
  [key: string]: unknown
}

export async function getNotionBlocks(env: NotionEnv): Promise<Response> {
  const res = await fetch(`https://api.notion.com/v1/blocks/${NOTION_PAGE_ID}/children?page_size=100`, {
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    return new Response(`Notion API error: ${res.status} ${body}`, { status: 502 })
  }

  const data = await res.json<{ results: NotionBlock[] }>()
  return Response.json(data.results)
}
