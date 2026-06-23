-- SQL Migration: Add passwordless WhatsApp login columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_login_code VARCHAR(10);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_login_code_expires_at TIMESTAMP WITH TIME ZONE;
