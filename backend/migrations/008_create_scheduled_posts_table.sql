-- Scheduled multi-platform posts (Social Hub)
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  media_file_path TEXT,
  media_original_name TEXT,
  youtube_title TEXT,
  youtube_description TEXT,
  youtube_privacy_status TEXT DEFAULT 'unlisted',
  facebook_page_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user ON scheduled_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due ON scheduled_posts (scheduled_at) WHERE status = 'pending';
