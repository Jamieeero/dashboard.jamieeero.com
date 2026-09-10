interface Env {
  DASHBOARD_DB: D1Database
  DASHBOARD_BUCKET: R2Bucket
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DASHBOARD_DB.prepare(
    'SELECT id, name, folder, size, uploaded_at as uploadedAt, sort_order as sortOrder FROM files ORDER BY uploaded_at DESC'
  ).all()

  return Response.json(results)
}
