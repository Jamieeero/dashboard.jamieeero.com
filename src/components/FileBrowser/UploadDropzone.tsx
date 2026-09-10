import { useRef, useState } from 'react'

interface UploadDropzoneProps {
  folder: string
  onUploaded: () => void
}

export default function UploadDropzone({ folder, onUploaded }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(files: FileList) {
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      form.append('folder', folder)
      await fetch('/api/files/upload', { method: 'POST', body: form })
    }
    onUploaded()
  }

  return (
    <div
      className={'dropzone' + (dragging ? ' dropzone--active' : '')}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
      />
      <p>Drop files here, or click to browse</p>
      <p className="dropzone__folder">uploading to {folder}</p>
    </div>
  )
}
