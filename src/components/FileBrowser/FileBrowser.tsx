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
  const [activeFolder, setActiveFolder] = useState('/')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/files')
      const data: FileEntry[] = await res.json()
      setFiles(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const folders = useMemo(() => {
    const set = new Set<string>(['/'])
    files.forEach((f) => set.add(f.folder))
    return Array.from(set).sort()
  }, [files])

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
    refresh()
  }

  return (
    <section className="panel panel--files">
      <header className="panel__header">
        <h2>Files</h2>
        <span className="meta">r2 · {files.length} items</span>
      </header>
      <div className="panel__body panel__body--padded file-browser">
        <aside className="file-browser__sidebar">
          <FolderTree folders={folders} activeFolder={activeFolder} onSelect={setActiveFolder} />
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
          <UploadDropzone folder={activeFolder} onUploaded={refresh} />
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
