-- Migration: Add from_number column to WhatsApp message history

ALTER TABLE whatsapp_messages
ADD COLUMN IF NOT EXISTS from_number VARCHAR(30);

