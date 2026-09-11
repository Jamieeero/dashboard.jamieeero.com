import { type Env, listFiles, uploadFile, getFile, deleteFile } from './handlers'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/files' && request.method === 'GET') {
      return listFiles(env)
    }

    if (url.pathname === '/api/files/upload' && request.method === 'POST') {
      return uploadFile(request, env)
    }

    const idMatch = url.pathname.match(/^\/api\/files\/([^/]+)$/)
    if (idMatch) {
      const id = idMatch[1]
      if (request.method === 'GET') return getFile(id, env)
      if (request.method === 'DELETE') return deleteFile(id, env)
    }

    // Not an API route — serve the built React app / static files.
    return env.ASSETS.fetch(request)
  },
}
