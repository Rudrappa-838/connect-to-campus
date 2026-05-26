-- Migration to add SMS configuration columns to schools table

ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_provider VARCHAR(50);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_api_key VARCHAR(255);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_sender_id VARCHAR(50);
