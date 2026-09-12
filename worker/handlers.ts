export interface Env {
  DASHBOARD_DB: D1Database
  DASHBOARD_BUCKET: R2Bucket
  ASSETS: Fetcher
}

// ---------------------------------------------------------------
// Files
// ---------------------------------------------------------------

export async function listFiles(env: Env): Promise<Response> {
  const { results } = await env.DASHBOARD_DB.prepare(
    'SELECT id, name, folder, size, uploaded_at as uploadedAt, sort_order as sortOrder FROM files ORDER BY sort_order ASC, uploaded_at DESC'
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

  // New uploads go to the end of the folder's custom order instead of
  // all sharing sort_order = 0 (which made "Sort: custom" a no-op).
  const maxRow = await env.DASHBOARD_DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM files WHERE folder = ?'
  )
    .bind(folder)
    .first<{ maxOrder: number }>()
  const sortOrder = (maxRow?.maxOrder ?? -1) + 1

  const now = new Date().toISOString()
  await env.DASHBOARD_DB.prepare(
    `INSERT INTO files (id, name, folder, size, uploaded_at, sort_order, r2_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, file.name, folder, file.size, now, sortOrder, r2Key)
    .run()

  return Response.json({ id, name: file.name, folder, size: file.size, uploadedAt: now, sortOrder })
}

export async function getFile(id: string, env: Env, inline: boolean): Promise<Response> {
  const row = await env.DASHBOARD_DB.prepare('SELECT r2_key, name FROM files WHERE id = ?')
    .bind(id)
    .first<{ r2_key: string; name: string }>()

  if (!row) return new Response('Not found', { status: 404 })

  const object = await env.DASHBOARD_BUCKET.get(row.r2_key)
  if (!object) return new Response('Not found', { status: 404 })

  return new Response(object.body, {
    headers: {
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${row.name}"`,
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=0',
    },
  })
}

export async function deleteFile(id: string, env: Env): Promise<Response> {
  const row = await env.DASHBOARD_DB.prepare('SELECT r2_key FROM files WHERE id = ?')
    .bind(id)
    .first<{ r2_key: string }>()

  if (row) {
    await env.DASHBOARD_BUCKET.delete(row.r2_key)
    await env.DASHBOARD_DB.batch([
      env.DASHBOARD_DB.prepare('DELETE FROM files WHERE id = ?').bind(id),
      env.DASHBOARD_DB.prepare('DELETE FROM share_links WHERE file_id = ?').bind(id),
    ])
  }

  return new Response(null, { status: 204 })
}

export async function bulkDeleteFiles(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ ids?: string[] }>()
  const ids = body.ids ?? []
  if (!ids.length) return new Response('No ids provided', { status: 400 })

  const placeholders = ids.map(() => '?').join(',')
  const { results } = await env.DASHBOARD_DB.prepare(
    `SELECT id, r2_key FROM files WHERE id IN (${placeholders})`
  )
    .bind(...ids)
    .all<{ id: string; r2_key: string }>()

  for (const row of results) {
    await env.DASHBOARD_BUCKET.delete(row.r2_key)
  }

  await env.DASHBOARD_DB.batch([
    env.DASHBOARD_DB.prepare(`DELETE FROM files WHERE id IN (${placeholders})`).bind(...ids),
    env.DASHBOARD_DB.prepare(`DELETE FROM share_links WHERE file_id IN (${placeholders})`).bind(...ids),
  ])

  return Response.json({ deleted: results.map((r) => r.id) })
}

export async function updateFile(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ name?: string; folder?: string; sortOrder?: number }>()

  const row = await env.DASHBOARD_DB.prepare(
    'SELECT r2_key, name, folder, sort_order as sortOrder FROM files WHERE id = ?'
  )
    .bind(id)
    .first<{ r2_key: string; name: string; folder: string; sortOrder: number }>()
  if (!row) return new Response('Not found', { status: 404 })

  const newName = body.name ?? row.name
  const newFolder = body.folder ?? row.folder
  let newSortOrder = body.sortOrder ?? row.sortOrder
  let newR2Key = row.r2_key

  // Keep the R2 object's path in sync with the logical folder so the
  // bucket layout doesn't silently drift from what the UI shows.
  if (newFolder !== row.folder) {
    const fileNamePart = row.r2_key.split('/').pop()!
    newR2Key = `${newFolder === '/' ? '' : newFolder.replace(/^\//, '') + '/'}${fileNamePart}`
    const object = await env.DASHBOARD_BUCKET.get(row.r2_key)
    if (object) {
      await env.DASHBOARD_BUCKET.put(newR2Key, object.body, {
        httpMetadata: object.httpMetadata,
      })
      await env.DASHBOARD_BUCKET.delete(row.r2_key)
    }

    if (body.sortOrder === undefined) {
      // No explicit position given — drop it at the end of the target folder
      // instead of keeping its old-folder order value.
      const maxRow = await env.DASHBOARD_DB.prepare(
        'SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM files WHERE folder = ?'
      )
        .bind(newFolder)
        .first<{ maxOrder: number }>()
      newSortOrder = (maxRow?.maxOrder ?? -1) + 1
    }
  }

  await env.DASHBOARD_DB.prepare(
    'UPDATE files SET name = ?, folder = ?, sort_order = ?, r2_key = ? WHERE id = ?'
  )
    .bind(newName, newFolder, newSortOrder, newR2Key, id)
    .run()

  return Response.json({ id, name: newName, folder: newFolder, sortOrder: newSortOrder })
}

export async function reorderFiles(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ ids?: string[] }>()
  const ids = body.ids ?? []
  if (!ids.length) return new Response('No ids provided', { status: 400 })

  await env.DASHBOARD_DB.batch(
    ids.map((id, index) =>
      env.DASHBOARD_DB.prepare('UPDATE files SET sort_order = ? WHERE id = ?').bind(index, id)
    )
  )

  return Response.json({ ok: true })
}

// ---------------------------------------------------------------
// Folders
// ---------------------------------------------------------------

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

export async function renameFolder(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ oldPath?: string; newPath?: string }>()
  const oldPath = (body.oldPath ?? '').trim()
  let newPath = (body.newPath ?? '').trim()
  if (!oldPath || oldPath === '/' || !newPath) {
    return new Response('Invalid folder path', { status: 400 })
  }
  if (!newPath.startsWith('/')) newPath = `/${newPath}`

  // Update the folder itself and every nested subfolder path, then every
  // file whose folder is the renamed folder or lives underneath it.
  const { results: allFolders } = await env.DASHBOARD_DB.prepare('SELECT path FROM folders').all<{
    path: string
  }>()
  const statements = []
  for (const { path } of allFolders) {
    if (path === oldPath) {
      statements.push(
        env.DASHBOARD_DB.prepare('UPDATE folders SET path = ? WHERE path = ?').bind(newPath, path)
      )
    } else if (path.startsWith(`${oldPath}/`)) {
      const updated = newPath + path.slice(oldPath.length)
      statements.push(
        env.DASHBOARD_DB.prepare('UPDATE folders SET path = ? WHERE path = ?').bind(updated, path)
      )
    }
  }

  const { results: affectedFiles } = await env.DASHBOARD_DB.prepare(
    "SELECT id, folder, r2_key FROM files WHERE folder = ? OR folder LIKE ? || '/%'"
  )
    .bind(oldPath, oldPath)
    .all<{ id: string; folder: string; r2_key: string }>()

  for (const file of affectedFiles) {
    const updatedFolder = file.folder === oldPath ? newPath : newPath + file.folder.slice(oldPath.length)
    const fileNamePart = file.r2_key.split('/').pop()!
    const updatedR2Key = `${updatedFolder === '/' ? '' : updatedFolder.replace(/^\//, '') + '/'}${fileNamePart}`
    const object = await env.DASHBOARD_BUCKET.get(file.r2_key)
    if (object) {
      await env.DASHBOARD_BUCKET.put(updatedR2Key, object.body, { httpMetadata: object.httpMetadata })
      await env.DASHBOARD_BUCKET.delete(file.r2_key)
    }
    statements.push(
      env.DASHBOARD_DB.prepare('UPDATE files SET folder = ?, r2_key = ? WHERE id = ?').bind(
        updatedFolder,
        updatedR2Key,
        file.id
      )
    )
  }

  if (statements.length) await env.DASHBOARD_DB.batch(statements)

  return Response.json({ path: newPath })
}

export async function deleteFolder(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.searchParams.get('path') ?? ''
  if (!path || path === '/') return new Response('Invalid folder path', { status: 400 })

  // Files (and subfolders) inside the deleted folder move up to root
  // rather than being silently orphaned.
  await env.DASHBOARD_DB.batch([
    env.DASHBOARD_DB.prepare("UPDATE files SET folder = '/' WHERE folder = ? OR folder LIKE ? || '/%'").bind(
      path,
      path
    ),
    env.DASHBOARD_DB.prepare("DELETE FROM folders WHERE path = ? OR path LIKE ? || '/%'").bind(
      path,
      path
    ),
  ])

  return new Response(null, { status: 204 })
}

// ---------------------------------------------------------------
// Storage stats
// ---------------------------------------------------------------

export async function getStorageStats(env: Env): Promise<Response> {
  const row = await env.DASHBOARD_DB.prepare(
    'SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as totalBytes FROM files'
  ).first<{ count: number; totalBytes: number }>()
  return Response.json(row)
}

// ---------------------------------------------------------------
// Share links
// ---------------------------------------------------------------

export async function createShareLink(id: string, request: Request, env: Env): Promise<Response> {
  const row = await env.DASHBOARD_DB.prepare('SELECT id FROM files WHERE id = ?').bind(id).first()
  if (!row) return new Response('Not found', { status: 404 })

  let expiresInMinutes = 60 * 24
  try {
    const body = await request.json<{ expiresInMinutes?: number }>()
    if (body.expiresInMinutes) expiresInMinutes = body.expiresInMinutes
  } catch {
    // no body provided — use the default expiry
  }

  const token = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60_000)

  await env.DASHBOARD_DB.prepare(
    'INSERT INTO share_links (token, file_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  )
    .bind(token, id, now.toISOString(), expiresAt.toISOString())
    .run()

  return Response.json({ token, expiresAt: expiresAt.toISOString() })
}

export async function getSharedFile(token: string, env: Env): Promise<Response> {
  const link = await env.DASHBOARD_DB.prepare(
    'SELECT file_id as fileId, expires_at as expiresAt FROM share_links WHERE token = ?'
  )
    .bind(token)
    .first<{ fileId: string; expiresAt: string }>()

  if (!link) return new Response('Not found', { status: 404 })
  if (new Date(link.expiresAt).getTime() < Date.now()) {
    return new Response('This share link has expired', { status: 410 })
  }

  return getFile(link.fileId, env, true)
}
