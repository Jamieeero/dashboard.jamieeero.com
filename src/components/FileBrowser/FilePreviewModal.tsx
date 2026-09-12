import { useEffect } from 'react'
import type { FileEntry } from '../../types'

interface FilePreviewModalProps {
  file: FileEntry
  onClose: () => void
}

function isImage(name: string) {
  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(name)
}

function isPdf(name: string) {
  return /\.pdf$/i.test(name)
}

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const previewUrl = `/api/files/${file.id}?mode=preview`

  return (
    <div className="preview-modal__overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <header className="preview-modal__header">
          <span>{file.name}</span>
          <button className="preview-modal__close" onClick={onClose} aria-label="Close preview">
            ×
          </button>
        </header>
        <div className="preview-modal__body">
          {isImage(file.name) ? (
            <img src={previewUrl} alt={file.name} />
          ) : isPdf(file.name) ? (
            <iframe title={file.name} src={previewUrl} />
          ) : (
            <p className="preview-modal__none">
              No inline preview for this file type.{' '}
              <a href={`/api/files/${file.id}`}>Download it</a> instead.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
