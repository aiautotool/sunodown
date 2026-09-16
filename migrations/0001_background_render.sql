CREATE TABLE IF NOT EXISTS render_jobs (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  input_json TEXT NOT NULL,
  result_key TEXT,
  result_url TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_render_jobs_installation ON render_jobs(installation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status, updated_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_installation ON push_subscriptions(installation_id);
