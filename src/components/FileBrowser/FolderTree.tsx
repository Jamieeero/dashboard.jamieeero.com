interface FolderTreeProps {
  folders: string[]
  activeFolder: string
  onSelect: (folder: string) => void
}

export default function FolderTree({ folders, activeFolder, onSelect }: FolderTreeProps) {
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
    </nav>
  )
}
