PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, document TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS resumes_owner ON resumes(owner_id, deleted_at, updated_at);
CREATE TABLE IF NOT EXISTS resume_history (
  id TEXT PRIMARY KEY, resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, document TEXT NOT NULL,
  revision INTEGER NOT NULL, source TEXT NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE(resume_id, revision)
);
CREATE INDEX IF NOT EXISTS history_owner_resume ON resume_history(owner_id, resume_id, revision DESC);
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, scope TEXT NOT NULL,
  resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS api_tokens_owner ON api_tokens(owner_id);
CREATE TABLE IF NOT EXISTS import_receipts (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, source_key TEXT NOT NULL,
  resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  PRIMARY KEY(owner_id, source_key)
);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS history_receipts (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, source_key TEXT NOT NULL,
  history_id TEXT NOT NULL REFERENCES resume_history(id) ON DELETE CASCADE,
  PRIMARY KEY(owner_id, source_key)
);
