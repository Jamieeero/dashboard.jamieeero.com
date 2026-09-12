import {
  type Env,
  listFiles,
  uploadFile,
  getFile,
  deleteFile,
  bulkDeleteFiles,
  updateFile,
  reorderFiles,
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  getStorageStats,
  createShareLink,
  getSharedFile,
} from './handlers'
import { getNotionContent, type NotionEnv } from './notion'
import { getCalendarEvents, type CalendarEnv } from './calendar'

export default {
  async fetch(request: Request, env: Env & NotionEnv & CalendarEnv): Promise<Response> {
    const url = new URL(request.url)

    // Share links are meant to be opened by anyone holding the token
    // (that's the point of "sharing"), so they're excluded from the
    // otherwise-authenticated /api surface below.
    const shareMatch = url.pathname.match(/^\/api\/share\/([^/]+)$/)
    if (shareMatch && request.method === 'GET') {
      return getSharedFile(shareMatch[1], env)
    }

    if (url.pathname === '/api/notion' && request.method === 'GET') {
      return getNotionContent(env)
    }

    if (url.pathname === '/api/calendar' && request.method === 'GET') {
      return getCalendarEvents(env)
    }

    if (url.pathname === '/api/storage' && request.method === 'GET') {
      return getStorageStats(env)
    }

    if (url.pathname === '/api/folders' && request.method === 'GET') {
      return listFolders(env)
    }

    if (url.pathname === '/api/folders' && request.method === 'POST') {
      return createFolder(request, env)
    }

    if (url.pathname === '/api/folders/rename' && request.method === 'POST') {
      return renameFolder(request, env)
    }

    if (url.pathname === '/api/folders' && request.method === 'DELETE') {
      return deleteFolder(request, env)
    }

    if (url.pathname === '/api/files' && request.method === 'GET') {
      return listFiles(env)
    }

    if (url.pathname === '/api/files/upload' && request.method === 'POST') {
      return uploadFile(request, env)
    }

    if (url.pathname === '/api/files/reorder' && request.method === 'POST') {
      return reorderFiles(request, env)
    }

    if (url.pathname === '/api/files/bulk-delete' && request.method === 'POST') {
      return bulkDeleteFiles(request, env)
    }

    const shareCreateMatch = url.pathname.match(/^\/api\/files\/([^/]+)\/share$/)
    if (shareCreateMatch && request.method === 'POST') {
      return createShareLink(shareCreateMatch[1], request, env)
    }

    const idMatch = url.pathname.match(/^\/api\/files\/([^/]+)$/)
    if (idMatch) {
      const id = idMatch[1]
      if (request.method === 'GET') return getFile(id, env, url.searchParams.get('mode') === 'preview')
      if (request.method === 'DELETE') return deleteFile(id, env)
      if (request.method === 'PATCH') return updateFile(id, request, env)
    }

    // Not an API route — serve the built React app / static files.
    return env.ASSETS.fetch(request)
  },
}
