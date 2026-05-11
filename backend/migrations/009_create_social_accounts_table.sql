CREATE TABLE IF NOT EXISTS social_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  provider_account_id VARCHAR(255),
  provider_account_name VARCHAR(255),
  provider_account_email VARCHAR(255),
  scope TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider)
);

ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS provider_account_email VARCHAR(255);
