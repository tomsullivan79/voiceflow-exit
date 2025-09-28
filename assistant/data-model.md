# Data Model — Snapshot (public schema)

## Tables
### conversations
- **id (uuid, pk)**
- user_id (uuid) — owner for web chat = `WEB_CHAT_OWNER_USER_ID`
- source (text) — "web", "sms", etc.
- title (text)
- closed_at (timestamptz, nullable)

### conversation_messages
- **id (uuid, pk)**
- conversation_id (uuid, fk → conversations.id)
- role (text) — "user" | "assistant"
- text (text)
- message_sid (text, nullable) — Twilio SID for delivery tracking
- created_at (timestamptz)

### web_conversation_cookies
- **cookie_id (uuid, pk)**
- conversation_id (uuid, fk → conversations.id)
- created_at (timestamptz)

### sms_events
- **id (uuid, pk)**
- message_sid (text, index)
- message_status (text, index)
- payload (jsonb)
- created_at (timestamptz, index desc)

## Views
### conversation_activity (planned/exists)
- Purpose: ordering + last message time per conversation.

## Indexes (confirmed)
- sms_events: `(message_sid, created_at DESC)`, `(created_at DESC)`, `(message_status)`

## Enums / Meta
- species_meta (planned table): fields for `dangerous`, `rabies_vector`, `referral_required`, `intervention_needed`…

> Source of truth for schema will live in `db/SCHEMA.sql` and `db/SCHEMA.md` (see step C1).
