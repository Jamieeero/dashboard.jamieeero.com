import { useRef, useState } from 'react'

interface UploadDropzoneProps {
  folder: string
  onUploaded: () => void
}

const CONCURRENCY = 3

async function uploadOne(file: File, folder: string): Promise<{ name: string; ok: boolean }> {
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)
  try {
    const res = await fetch('/api/files/upload', { method: 'POST', body: form })
    return { name: file.name, ok: res.ok }
  } catch {
    return { name: file.name, ok: false }
  }
}

export default function UploadDropzone({ folder, onUploaded }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(fileList: FileList) {
    const files = Array.from(fileList)
    setStatus(`Uploading 0/${files.length}…`)

    const failed: string[] = []
    let completed = 0
    let cursor = 0

    async function worker() {
      while (cursor < files.length) {
        const file = files[cursor++]
        const result = await uploadOne(file, folder)
        if (!result.ok) failed.push(result.name)
        completed++
        setStatus(`Uploading ${completed}/${files.length}…`)
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker())
    )

    if (failed.length) {
      setStatus(`${failed.length} of ${files.length} failed: ${failed.join(', ')}`)
    } else {
      setStatus(null)
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
      <p className="dropzone__folder">
        {status ?? `uploading to ${folder}`}
      </p>
    </div>
  )
}
