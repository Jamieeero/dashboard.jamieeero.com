import { useEffect, useMemo, useState } from 'react'
import type { FileEntry, ShareLinkResult, SortKey, StorageStats } from '../../types'
import FolderTree from './FolderTree'
import UploadDropzone from './UploadDropzone'
import FilePreviewModal from './FilePreviewModal'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function readDraggedFileIds(e: React.DragEvent): string[] {
  try {
    const raw = e.dataTransfer.getData('application/x-file-ids')
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export default function FileBrowser() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [folders, setFolders] = useState<string[]>(['/'])
  const [activeFolder, setActiveFolder] = useState('/')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null)
  const [storage, setStorage] = useState<StorageStats | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)

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

  async function refreshStorage() {
    const res = await fetch('/api/storage')
    setStorage(await res.json())
  }

  useEffect(() => {
    refreshFiles()
    refreshFolders()
    refreshStorage()
  }, [])

  const visible = useMemo(() => {
    const inFolder =
      activeFolder === '/' ? files : files.filter((f) => f.folder === activeFolder)
    const searched = search.trim()
      ? inFolder.filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase()))
      : inFolder
    const sorted = [...searched]
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
  }, [files, activeFolder, sortKey, search])

  useEffect(() => {
    // Drop selections that scrolled out of view (folder/search changed).
    setSelectedIds((prev) => {
      const visibleIds = new Set(visible.map((f) => f.id))
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [visible])

  async function handleDelete(id: string) {
    const file = files.find((f) => f.id === id)
    if (!window.confirm(`Delete "${file?.name ?? 'this file'}"? This can't be undone.`)) return
    await fetch(`/api/files/${id}`, { method: 'DELETE' })
    refreshFiles()
    refreshStorage()
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    if (!ids.length) return
    if (!window.confirm(`Delete ${ids.length} selected file(s)? This can't be undone.`)) return
    await fetch('/api/files/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setSelectedIds(new Set())
    refreshFiles()
    refreshStorage()
  }

  async function handleMove(id: string, folder: string) {
    await fetch(`/api/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder }),
    })
    refreshFiles()
  }

  async function handleBulkMove(folder: string) {
    const ids = [...selectedIds]
    if (!ids.length) return
    await Promise.all(ids.map((id) => handleMove(id, folder)))
    setSelectedIds(new Set())
  }

  async function handleRename(id: string, name: string) {
    const trimmed = name.trim()
    setEditingId(null)
    if (!trimmed) return
    await fetch(`/api/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    refreshFiles()
  }

  async function persistReorder(orderedIds: string[]) {
    setFiles((prev) => {
      const orderIndex = new Map(orderedIds.map((id, i) => [id, i]))
      return prev.map((f) => (orderIndex.has(f.id) ? { ...f, sortOrder: orderIndex.get(f.id)! } : f))
    })
    await fetch('/api/files/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: orderedIds }),
    })
  }

  function handleRowDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (search.trim()) return // reordering a filtered subset isn't meaningful
    const draggedIds = readDraggedFileIds(e)
    if (!draggedIds.length || draggedIds.includes(targetId)) return
    const currentOrder = visible.map((f) => f.id)
    const withoutDragged = currentOrder.filter((id) => !draggedIds.includes(id))
    const targetIndex = withoutDragged.indexOf(targetId)
    const newOrder = [
      ...withoutDragged.slice(0, targetIndex),
      ...draggedIds,
      ...withoutDragged.slice(targetIndex),
    ]
    setSortKey('custom')
    persistReorder(newOrder)
  }

  async function handleCreateFolder(path: string) {
    await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    refreshFolders()
  }

  async function handleRenameFolder(oldPath: string, newPath: string) {
    await fetch('/api/folders/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath }),
    })
    if (activeFolder === oldPath || activeFolder.startsWith(`${oldPath}/`)) {
      setActiveFolder(activeFolder.replace(oldPath, newPath))
    }
    refreshFolders()
    refreshFiles()
  }

  async function handleDeleteFolder(path: string) {
    await fetch(`/api/folders?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
    if (activeFolder === path || activeFolder.startsWith(`${path}/`)) setActiveFolder('/')
    refreshFolders()
    refreshFiles()
  }

  function handleDropOnFolder(folder: string, fileIds: string[]) {
    fileIds.forEach((id) => handleMove(id, folder))
    setSelectedIds(new Set())
  }

  async function handleShare(file: FileEntry) {
    const res = await fetch(`/api/files/${file.id}/share`, { method: 'POST' })
    const data: ShareLinkResult = await res.json()
    const url = `${window.location.origin}/api/share/${data.token}`
    try {
      await navigator.clipboard.writeText(url)
      setShareMessage(`Link copied — expires ${new Date(data.expiresAt).toLocaleString()}`)
    } catch {
      setShareMessage(url)
    }
    setTimeout(() => setShareMessage(null), 6000)
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === visible.length ? new Set() : new Set(visible.map((f) => f.id))
    )
  }

  return (
    <section className="panel panel--files">
      <header className="panel__header">
        <h2>Files</h2>
        <span className="meta">
          r2 · {files.length} items
          {storage ? ` · ${formatSize(storage.totalBytes)}` : ''}
        </span>
      </header>
      <div className="panel__body panel__body--padded file-browser">
        <aside className="file-browser__sidebar">
          <FolderTree
            folders={folders}
            activeFolder={activeFolder}
            onSelect={setActiveFolder}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onDropFiles={handleDropOnFolder}
          />
        </aside>
        <div className="file-browser__main">
          <div className="file-browser__toolbar">
            <input
              className="file-browser__search"
              type="search"
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              <option value="date">Sort: newest</option>
              <option value="name">Sort: name</option>
              <option value="size">Sort: size</option>
              <option value="custom">Sort: custom (drag rows)</option>
            </select>
          </div>

          {selectedIds.size > 0 && (
            <div className="file-browser__bulkbar">
              <span>{selectedIds.size} selected</span>
              <select defaultValue="" onChange={(e) => e.target.value && handleBulkMove(e.target.value)}>
                <option value="" disabled>
                  Move to…
                </option>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f === '/' ? 'All files' : f}
                  </option>
                ))}
              </select>
              <button onClick={handleBulkDelete}>Delete selected</button>
              <button onClick={() => setSelectedIds(new Set())}>Clear</button>
            </div>
          )}

          {shareMessage && <div className="file-browser__toast">{shareMessage}</div>}

          <UploadDropzone
            folder={activeFolder}
            onUploaded={() => {
              refreshFiles()
              refreshFolders()
              refreshStorage()
            }}
          />
          {loading ? (
            <p className="file-browser__empty">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="file-browser__empty">
              {search ? 'No files match your search.' : 'No files in this folder yet.'}
            </p>
          ) : (
            <ul className="file-browser__list">
              <li className="file-browser__row file-browser__row--head">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === visible.length}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
                <span />
                <span />
                <span />
                <span />
                <span />
              </li>
              {visible.map((file) => (
                <li
                  key={file.id}
                  className="file-browser__row"
                  draggable
                  onDragStart={(e) => {
                    const ids = selectedIds.has(file.id) ? [...selectedIds] : [file.id]
                    e.dataTransfer.setData('application/x-file-ids', JSON.stringify(ids))
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleRowDrop(e, file.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(file.id)}
                    onChange={() => toggleSelected(file.id)}
                    aria-label={`Select ${file.name}`}
                  />
                  {editingId === file.id ? (
                    <input
                      className="file-browser__rename-input"
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(file.id, editingName)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={() => handleRename(file.id, editingName)}
                    />
                  ) : (
                    <span
                      className="file-browser__name"
                      title="Click to preview, double-click to rename"
                      onClick={() => setPreviewFile(file)}
                      onDoubleClick={() => {
                        setEditingId(file.id)
                        setEditingName(file.name)
                      }}
                    >
                      {file.name}
                    </span>
                  )}
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
                  <span className="file-browser__actions">
                    <button
                      className="file-browser__icon-btn"
                      onClick={() => handleShare(file)}
                      aria-label={`Share ${file.name}`}
                      title="Copy share link (expires in 24h)"
                    >
                      🔗
                    </button>
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
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </section>
  )
}
