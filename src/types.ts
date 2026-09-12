export interface FileEntry {
  id: string
  name: string
  folder: string // e.g. "/", "/receipts", "/receipts/2026"
  size: number
  uploadedAt: string // ISO timestamp
  sortOrder: number
}

export type SortKey = 'name' | 'date' | 'size' | 'custom'

export interface StorageStats {
  count: number
  totalBytes: number
}

export interface ShareLinkResult {
  token: string
  expiresAt: string
}
