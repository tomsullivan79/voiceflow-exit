# DB Schema — Source of Truth (public)

> **Status:** Initial snapshot (to be backfilled from Supabase).  
> When you change schema in Supabase SQL Editor, paste the exact SQL you ran into `db/CHANGES/YYYY-MM-DD_description.sql` and update this file.

## Tables (known so far)
### conversations
- **id** (uuid, pk)
- user_id (uuid) — web chat owner = `WEB_CHAT_OWNER_USER_ID`
- source (text) — "web" | "sms" | …
- title (text)
- closed_at (timestamptz, null)

### conversation_messages
- **id** (uuid, pk)
- conversation_id (uuid, fk → conversations.id)
- role (text) — "user" | "assistant"
- text (text)
- message_sid (text, null) — Twilio SID for delivery tracking
- created_at (timestamptz)

### web_conversation_cookies
- **cookie_id** (uuid, pk)
- conversation_id (uuid, fk → conversations.id)
- created_at (timestamptz)

### sms_events
- **id** (uuid, pk)
- message_sid (text, index)
- message_status (text, index)
- payload (jsonb)
- created_at (timestamptz, index desc)

## Views
- conversation_activity (planned) — ordering + last message time

## Indexes (confirmed)
- sms_events: `(message_sid, created_at DESC)`, `(created_at DESC)`, `(message_status)`

## Enums / Meta (planned)
- species_meta fields: `dangerous` (bool), `rabies_vector` (bool), `referral_required` (enum),
  `intervention_needed` (enum), `active_hours` (enum), `seasonal_flags` (jsonb)

---
**Next (C1-1):** Backfill `SCHEMA.sql` from Supabase and create `db/CHANGES/*` entries for future edits.
