-- Migration: Create Social Integration Tables (Facebook, Instagram, Twitter)
-- Phase 5: Multi-platform social publishing
-- Tables:
--   facebook_oauth_tokens, facebook_pages, facebook_posts
--   instagram_oauth_tokens, instagram_accounts, instagram_posts
--   twitter_oauth_tokens, twitter_posts

-- ============================================================================
-- Facebook tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS facebook_oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMP,
  facebook_user_id VARCHAR(255),
  facebook_user_name VARCHAR(255),
  facebook_user_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS facebook_pages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  page_id VARCHAR(255) NOT NULL,
  page_name VARCHAR(255) NOT NULL,
  page_access_token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, page_id)
);

CREATE TABLE IF NOT EXISTS facebook_posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  page_id VARCHAR(255) NOT NULL,
  facebook_post_id VARCHAR(255),
  message TEXT NOT NULL,
  media_type VARCHAR(50), -- text, photo, video
  media_url TEXT,
  created_time TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, facebook_post_id)
);

CREATE INDEX IF NOT EXISTS idx_facebook_oauth_tokens_user_id ON facebook_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_facebook_oauth_tokens_expires_at ON facebook_oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_facebook_pages_user_id ON facebook_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_user_id ON facebook_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_page_id ON facebook_posts(page_id);

-- ============================================================================
-- Instagram tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS instagram_oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMP,
  instagram_user_id VARCHAR(255),
  instagram_username VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ig_user_id VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  linked_page_id VARCHAR(255),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, ig_user_id)
);

CREATE TABLE IF NOT EXISTS instagram_posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ig_user_id VARCHAR(255) NOT NULL,
  instagram_post_id VARCHAR(255),
  caption TEXT,
  media_type VARCHAR(50), -- image, video, reel
  media_url TEXT,
  created_time TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, instagram_post_id)
);

CREATE INDEX IF NOT EXISTS idx_instagram_oauth_tokens_user_id ON instagram_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_oauth_tokens_expires_at ON instagram_oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_user_id ON instagram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_user_id ON instagram_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_ig_user_id ON instagram_posts(ig_user_id);

-- ============================================================================
-- Twitter/X tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS twitter_oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  scope TEXT,
  twitter_user_id VARCHAR(255),
  twitter_username VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS twitter_posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  twitter_post_id VARCHAR(255),
  text TEXT NOT NULL,
  media_keys TEXT[], -- array of media keys/ids from X API
  created_time TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, twitter_post_id)
);

CREATE INDEX IF NOT EXISTS idx_twitter_oauth_tokens_user_id ON twitter_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_twitter_oauth_tokens_expires_at ON twitter_oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_twitter_posts_user_id ON twitter_posts(user_id);

