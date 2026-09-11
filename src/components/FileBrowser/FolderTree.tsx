import { useState } from 'react'

interface FolderTreeProps {
  folders: string[]
  activeFolder: string
  onSelect: (folder: string) => void
  onCreateFolder: (path: string) => void
}

export default function FolderTree({
  folders,
  activeFolder,
  onSelect,
  onCreateFolder,
}: FolderTreeProps) {
  const [creating, setCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  function submitNewFolder() {
    const name = newFolderName.trim()
    if (name) onCreateFolder(name)
    setNewFolderName('')
    setCreating(false)
  }

  return (
    <nav className="folder-tree">
      {folders.map((folder) => (
        <button
          key={folder}
          className={
            'folder-tree__item' + (folder === activeFolder ? ' folder-tree__item--active' : '')
          }
          onClick={() => onSelect(folder)}
        >
          {folder === '/' ? 'All files' : folder}
        </button>
      ))}

      {creating ? (
        <input
          autoFocus
          className="folder-tree__input"
          placeholder="folder name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitNewFolder()
            if (e.key === 'Escape') {
              setCreating(false)
              setNewFolderName('')
            }
          }}
          onBlur={submitNewFolder}
        />
      ) : (
        <button className="folder-tree__item folder-tree__new" onClick={() => setCreating(true)}>
          + New folder
        </button>
      )}
    </nav>
  )
}
