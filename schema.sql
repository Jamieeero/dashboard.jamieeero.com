CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  folder TEXT NOT NULL DEFAULT '/',
  size INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files (folder);

CREATE TABLE IF NOT EXISTS folders (
  path TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS share_links (
  token TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_share_links_file ON share_links (file_id);
