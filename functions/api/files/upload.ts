interface Env {
  DASHBOARD_DB: D1Database
  DASHBOARD_BUCKET: R2Bucket
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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
