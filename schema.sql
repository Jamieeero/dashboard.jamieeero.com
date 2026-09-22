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

-- Connected inboxes (1 Outlook + up to several Gmail accounts). Tokens
-- live server-side only; the frontend only ever sees id/provider/label.
CREATE TABLE IF NOT EXISTS email_accounts (
  id TEXT PRIMARY KEY, -- `${provider}:${email_address}` so reconnecting updates in place
  provider TEXT NOT NULL, -- 'google' | 'microsoft'
  label TEXT NOT NULL,
  email_address TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- epoch ms
  connected_at TEXT NOT NULL
);

-- Which messages the dashboard has already marked read (opened or
-- dismissed). Only message ids from the last 7 days are ever looked
-- up here, so this table is self-pruning in practice.
CREATE TABLE IF NOT EXISTS email_seen (
  message_uid TEXT PRIMARY KEY, -- `${account_id}:${provider_message_id}`
  seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_seen_seen_at ON email_seen (seen_at);

-- Connected inboxes (1 Outlook + up to several Gmail accounts). Tokens
-- live server-side only; the frontend only ever sees id/provider/label.
CREATE TABLE IF NOT EXISTS email_accounts (
  id TEXT PRIMARY KEY, -- `${provider}:${email_address}` so reconnecting updates in place
  provider TEXT NOT NULL, -- 'google' | 'microsoft'
  label TEXT NOT NULL,
  email_address TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- epoch ms
  connected_at TEXT NOT NULL
);

-- Which messages the dashboard has already marked read (opened or
-- dismissed). Only message ids from the last 7 days are ever looked
-- up here, so this table is self-pruning in practice.
CREATE TABLE IF NOT EXISTS email_seen (
  message_uid TEXT PRIMARY KEY, -- `${account_id}:${provider_message_id}`
  seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_seen_seen_at ON email_seen (seen_at);