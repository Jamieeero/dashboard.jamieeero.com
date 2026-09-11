import { useEffect, useMemo, useState } from 'react'
import type { FileEntry, SortKey } from '../../types'
import FolderTree from './FolderTree'
import UploadDropzone from './UploadDropzone'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export default function FileBrowser() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [folders, setFolders] = useState<string[]>(['/'])
  const [activeFolder, setActiveFolder] = useState('/')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [loading, setLoading] = useState(true)

  async function refreshFiles() {
    setLoading(true)
    try {
      const res = await fetch('/api/files')
      const data: FileEntry[] = await res.json()
      setFiles(data)
    } finally {
      setLoading(false)
    }
  }

  async function refreshFolders() {
    const res = await fetch('/api/folders')
    const data: string[] = await res.json()
    setFolders(data)
  }

  useEffect(() => {
    refreshFiles()
    refreshFolders()
  }, [])

  const visible = useMemo(() => {
    const inFolder =
      activeFolder === '/' ? files : files.filter((f) => f.folder === activeFolder)
    const sorted = [...inFolder]
    switch (sortKey) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'size':
        sorted.sort((a, b) => b.size - a.size)
        break
      case 'custom':
        sorted.sort((a, b) => a.sortOrder - b.sortOrder)
        break
      case 'date':
      default:
        sorted.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    }
    return sorted
  }, [files, activeFolder, sortKey])

  async function handleDelete(id: string) {
    await fetch(`/api/files/${id}`, { method: 'DELETE' })
    refreshFiles()
  }

  async function handleMove(id: string, folder: string) {
    await fetch(`/api/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder }),
    })
    refreshFiles()
  }

  async function handleCreateFolder(path: string) {
    await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    refreshFolders()
  }

  return (
    <section className="panel panel--files">
      <header className="panel__header">
        <h2>Files</h2>
        <span className="meta">r2 · {files.length} items</span>
      </header>
      <div className="panel__body panel__body--padded file-browser">
        <aside className="file-browser__sidebar">
          <FolderTree
            folders={folders}
            activeFolder={activeFolder}
            onSelect={setActiveFolder}
            onCreateFolder={handleCreateFolder}
          />
        </aside>
        <div className="file-browser__main">
          <div className="file-browser__toolbar">
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              <option value="date">Sort: newest</option>
              <option value="name">Sort: name</option>
              <option value="size">Sort: size</option>
              <option value="custom">Sort: custom</option>
            </select>
          </div>
          <UploadDropzone
            folder={activeFolder}
            onUploaded={() => {
              refreshFiles()
              refreshFolders()
            }}
          />
          {loading ? (
            <p className="file-browser__empty">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="file-browser__empty">No files in this folder yet.</p>
          ) : (
            <ul className="file-browser__list">
              {visible.map((file) => (
                <li key={file.id} className="file-browser__row">
                  <span className="file-browser__name">{file.name}</span>
                  <span className="file-browser__size">{formatSize(file.size)}</span>
                  <span className="file-browser__date">
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </span>
                  <select
                    className="file-browser__move"
                    value={file.folder}
                    onChange={(e) => handleMove(file.id, e.target.value)}
                    aria-label={`Move ${file.name}`}
                  >
                    {folders.map((f) => (
                      <option key={f} value={f}>
                        {f === '/' ? 'All files' : f}
                      </option>
                    ))}
                  </select>
                  <a
                    className="file-browser__download"
                    href={`/api/files/${file.id}`}
                    aria-label={`Download ${file.name}`}
                    title="Download"
                  >
                    ⬇
                  </a>
                  <button onClick={() => handleDelete(file.id)} aria-label={`Delete ${file.name}`}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
