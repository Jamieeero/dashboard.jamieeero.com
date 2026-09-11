export interface Env {
  DASHBOARD_DB: D1Database
  DASHBOARD_BUCKET: R2Bucket
  ASSETS: Fetcher
}

export async function listFiles(env: Env): Promise<Response> {
  const { results } = await env.DASHBOARD_DB.prepare(
    'SELECT id, name, folder, size, uploaded_at as uploadedAt, sort_order as sortOrder FROM files ORDER BY uploaded_at DESC'
  ).all()
  return Response.json(results)
}

export async function uploadFile(request: Request, env: Env): Promise<Response> {
  const form = await request.formData()
  const file = form.get('file')
  const folder = (form.get('folder') as string) || '/'

  if (!(file instanceof File)) {
    return new Response('Missing file', { status: 400 })
  }

  const id = crypto.randomUUID()
  const r2Key = `${folder === '/' ? '' : folder.replace(/^\//, '') + '/'}${id}-${file.name}`

  await env.DASHBOARD_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  const now = new Date().toISOString()
  await env.DASHBOARD_DB.prepare(
    `INSERT INTO files (id, name, folder, size, uploaded_at, sort_order, r2_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, file.name, folder, file.size, now, 0, r2Key)
    .run()

  return Response.json({ id, name: file.name, folder, size: file.size, uploadedAt: now })
}

export async function getFile(id: string, env: Env): Promise<Response> {
  const row = await env.DASHBOARD_DB.prepare('SELECT r2_key, name FROM files WHERE id = ?')
    .bind(id)
    .first<{ r2_key: string; name: string }>()

  if (!row) return new Response('Not found', { status: 404 })

  const object = await env.DASHBOARD_BUCKET.get(row.r2_key)
  if (!object) return new Response('Not found', { status: 404 })

  return new Response(object.body, {
    headers: {
      'Content-Disposition': `attachment; filename="${row.name}"`,
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    },
  })
}

export async function deleteFile(id: string, env: Env): Promise<Response> {
  const row = await env.DASHBOARD_DB.prepare('SELECT r2_key FROM files WHERE id = ?')
    .bind(id)
    .first<{ r2_key: string }>()

  if (row) {
    await env.DASHBOARD_BUCKET.delete(row.r2_key)
    await env.DASHBOARD_DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run()
  }

  return new Response(null, { status: 204 })
}

export async function updateFile(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ name?: string; folder?: string }>()

  const row = await env.DASHBOARD_DB.prepare('SELECT r2_key, name, folder FROM files WHERE id = ?')
    .bind(id)
    .first<{ r2_key: string; name: string; folder: string }>()
  if (!row) return new Response('Not found', { status: 404 })

  const newName = body.name ?? row.name
  const newFolder = body.folder ?? row.folder

  await env.DASHBOARD_DB.prepare('UPDATE files SET name = ?, folder = ? WHERE id = ?')
    .bind(newName, newFolder, id)
    .run()

  return Response.json({ id, name: newName, folder: newFolder })
}

export async function listFolders(env: Env): Promise<Response> {
  const { results } = await env.DASHBOARD_DB.prepare(
    `SELECT path FROM folders
     UNION SELECT DISTINCT folder AS path FROM files
     ORDER BY path`
  ).all<{ path: string }>()

  const folders = results.map((r) => r.path)
  if (!folders.includes('/')) folders.unshift('/')
  return Response.json(folders)
}

export async function createFolder(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ path?: string }>()
  const path = (body.path ?? '').trim()
  if (!path || path === '/') return new Response('Invalid folder path', { status: 400 })

  const normalized = path.startsWith('/') ? path : `/${path}`
  await env.DASHBOARD_DB.prepare(
    'INSERT OR IGNORE INTO folders (path, created_at) VALUES (?, ?)'
  )
    .bind(normalized, new Date().toISOString())
    .run()

  return Response.json({ path: normalized })
}
