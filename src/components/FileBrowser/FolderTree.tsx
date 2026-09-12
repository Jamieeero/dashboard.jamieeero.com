import { useMemo, useRef, useState } from 'react'

interface FolderTreeProps {
  folders: string[]
  activeFolder: string
  onSelect: (folder: string) => void
  onCreateFolder: (path: string) => void
  onRenameFolder: (oldPath: string, newPath: string) => void
  onDeleteFolder: (path: string) => void
  onDropFiles: (folder: string, fileIds: string[]) => void
}

interface TreeNode {
  path: string
  label: string
  children: TreeNode[]
}

function buildTree(folders: string[]): TreeNode[] {
  const nonRoot = folders.filter((f) => f !== '/').sort()
  const nodesByPath = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const path of nonRoot) {
    const segments = path.split('/').filter(Boolean)
    const label = segments[segments.length - 1]
    const node: TreeNode = { path, label, children: [] }
    nodesByPath.set(path, node)

    const parentPath = '/' + segments.slice(0, -1).join('/')
    const parent = parentPath === '/' ? null : nodesByPath.get(parentPath)
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
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

export default function FolderTree({
  folders,
  activeFolder,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDropFiles,
}: FolderTreeProps) {
  const [creating, setCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const submittedRef = useRef(false)

  const tree = useMemo(() => buildTree(folders), [folders])

  function submitNewFolder() {
    if (submittedRef.current) return
    submittedRef.current = true
    const name = newFolderName.trim()
    if (name) onCreateFolder(name)
    setNewFolderName('')
    setCreating(false)
  }

  function startCreating() {
    submittedRef.current = false
    setCreating(true)
  }

  function submitRename(path: string) {
    const name = renameValue.trim()
    if (name && name !== path.split('/').filter(Boolean).pop()) {
      const parent = path.slice(0, path.lastIndexOf('/'))
      onRenameFolder(path, `${parent}/${name}`)
    }
    setRenamingPath(null)
  }

  function handleDragOver(e: React.DragEvent, path: string) {
    e.preventDefault()
    setDragOverPath(path)
  }

  function handleDrop(e: React.DragEvent, path: string) {
    e.preventDefault()
    setDragOverPath(null)
    const ids = readDraggedFileIds(e)
    if (ids.length) onDropFiles(path, ids)
  }

  function renderNode(node: TreeNode, depth: number) {
    const isRenaming = renamingPath === node.path
    return (
      <div key={node.path} className="folder-tree__node">
        <div
          className={
            'folder-tree__row' +
            (node.path === activeFolder ? ' folder-tree__row--active' : '') +
            (dragOverPath === node.path ? ' folder-tree__row--dragover' : '')
          }
          style={{ paddingLeft: depth * 14 }}
          onDragOver={(e) => handleDragOver(e, node.path)}
          onDragLeave={() => setDragOverPath((p) => (p === node.path ? null : p))}
          onDrop={(e) => handleDrop(e, node.path)}
        >
          {isRenaming ? (
            <input
              autoFocus
              className="folder-tree__input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename(node.path)
                if (e.key === 'Escape') setRenamingPath(null)
              }}
              onBlur={() => submitRename(node.path)}
            />
          ) : (
            <>
              <button className="folder-tree__item" onClick={() => onSelect(node.path)}>
                {node.label}
              </button>
              <span className="folder-tree__actions">
                <button
                  className="folder-tree__icon-btn"
                  title="Rename folder"
                  aria-label={`Rename ${node.label}`}
                  onClick={() => {
                    setRenamingPath(node.path)
                    setRenameValue(node.label)
                  }}
                >
                  ✎
                </button>
                <button
                  className="folder-tree__icon-btn folder-tree__icon-btn--danger"
                  title="Delete folder"
                  aria-label={`Delete ${node.label}`}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete "${node.label}"? Files inside will move to All files.`
                      )
                    ) {
                      onDeleteFolder(node.path)
                    }
                  }}
                >
                  ×
                </button>
              </span>
            </>
          )}
        </div>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <nav className="folder-tree">
      <div
        className={
          'folder-tree__row folder-tree__row--root' +
          (activeFolder === '/' ? ' folder-tree__row--active' : '') +
          (dragOverPath === '/' ? ' folder-tree__row--dragover' : '')
        }
        onDragOver={(e) => handleDragOver(e, '/')}
        onDragLeave={() => setDragOverPath((p) => (p === '/' ? null : p))}
        onDrop={(e) => handleDrop(e, '/')}
      >
        <button className="folder-tree__item" onClick={() => onSelect('/')}>
          All files
        </button>
      </div>

      {tree.map((node) => renderNode(node, 1))}

      {creating ? (
        <input
          autoFocus
          className="folder-tree__input folder-tree__input--new"
          placeholder="folder name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitNewFolder()
            if (e.key === 'Escape') {
              submittedRef.current = true
              setCreating(false)
              setNewFolderName('')
            }
          }}
          onBlur={submitNewFolder}
        />
      ) : (
        <button className="folder-tree__item folder-tree__new" onClick={startCreating}>
          + New folder
        </button>
      )}
    </nav>
  )
}
