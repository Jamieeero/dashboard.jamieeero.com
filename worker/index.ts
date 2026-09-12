import {
  type Env,
  listFiles,
  uploadFile,
  getFile,
  deleteFile,
  updateFile,
  listFolders,
  createFolder,
} from './handlers'
import { getNotionContent, type NotionEnv } from './notion'
import { getCalendarEvents, type CalendarEnv } from './calendar'

export default {
  async fetch(request: Request, env: Env & NotionEnv & CalendarEnv): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/notion' && request.method === 'GET') {
      return getNotionContent(env)
    }

    if (url.pathname === '/api/calendar' && request.method === 'GET') {
      return getCalendarEvents(env)
    }

    if (url.pathname === '/api/folders' && request.method === 'GET') {
      return listFolders(env)
    }

    if (url.pathname === '/api/folders' && request.method === 'POST') {
      return createFolder(request, env)
    }

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
      if (request.method === 'PATCH') return updateFile(id, request, env)
    }

    // Not an API route — serve the built React app / static files.
    return env.ASSETS.fetch(request)
  },
}
