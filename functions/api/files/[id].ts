interface Env {
  DASHBOARD_DB: D1Database
  DASHBOARD_BUCKET: R2Bucket
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = params.id as string
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

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = params.id as string
  const row = await env.DASHBOARD_DB.prepare('SELECT r2_key FROM files WHERE id = ?')
    .bind(id)
    .first<{ r2_key: string }>()

  if (row) {
    await env.DASHBOARD_BUCKET.delete(row.r2_key)
    await env.DASHBOARD_DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run()
  }

  return new Response(null, { status: 204 })
}
