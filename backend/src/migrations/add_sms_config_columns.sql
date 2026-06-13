-- Migration to add SMS configuration columns to schools table
-- Supports DLT-compliant SMS (mandatory in India for delivery to all phones)

ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_provider VARCHAR(50);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_api_key VARCHAR(255);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_sender_id VARCHAR(50);

-- DLT-specific columns (required for SMS to work in India — keypad & smartphone)
-- Entity ID: Your PE (Principal Entity) ID from DLT portal (e.g., Jio TrueConnect)
-- Template ID: Your approved message template ID from DLT portal
ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_entity_id VARCHAR(100);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_template_id VARCHAR(100);
