-- Migration: Create WhatsApp message history table
-- Stores outbound WhatsApp messages sent from DMAT

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  to_number VARCHAR(30) NOT NULL,
  message_text TEXT NOT NULL,
  message_id VARCHAR(255),
  wa_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'sent', -- sent, failed
  error_details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_id ON whatsapp_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);

