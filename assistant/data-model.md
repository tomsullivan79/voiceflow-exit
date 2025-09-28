# Data Model — Snapshot (public schema)

> **Source of truth:** `db/SCHEMA.sql` (committed in this repo). Keep this file in sync after any schema change. :contentReference[oaicite:0]{index=0}

---

## Tables

### conversations
- **id** (uuid, pk, default `gen_random_uuid()`)
- user_id (text, **not** uuid)
- channel (text, default `"sms"`)
- phone (text, null)
- title (text, null, default `"Conversation"`)
- status (text, default `"open"`)
- created_at (timestamptz, default `now()`)
- updated_at (timestamptz, default `now()`)
- closed_at (timestamptz, null)
- created_ip (text, null)

**Indexes**
- `idx_conversations_user` on `(user_id)`
- `idx_conversations_channel` on `(channel)`

---

### conversation_messages
- **id** (bigserial, pk)
- conversation_id (uuid, fk → `conversations.id` on delete **cascade**)
- role (text, not null)
- content (text, not null)
- created_at (timestamptz, default `now()`)
- message_sid (text, null)
- source_ip (text, null)

**Indexes**
- `idx_conv_msgs_conv` on `(conversation_id)`
- `idx_conversation_messages_message_sid` on `(message_sid)`

---

### web_conversation_cookies
- **cookie_id** (uuid, pk)
- conversation_id (uuid, fk → `conversations.id` on delete **cascade**)
- created_at (timestamptz, not null, default `now()`)

**Indexes**
- `web_conversation_cookies_conversation_id_idx` on `(conversation_id)`

---

### sms_events
- **id** (bigserial, pk)
- message_sid (text, null)
- to_number (text, null)
- from_number (text, null)
- message_status (text, null)
- error_code (text, null)
- error_message (text, null)
- payload (jsonb, null)
- created_at (timestamptz, default `now()`)

**Constraints**
- Unique `(message_sid, message_status, error_code)`

**Indexes**
- `idx_sms_events_message_sid` on `(message_sid)`
- `idx_sms_events_created_at` on `(created_at DESC)`
- `idx_sms_events_sid_created` on `(message_sid, created_at DESC)` *(duplicate aliases also exist; keep as-is from snapshot)*
- `sms_events_sid_created_idx` on `(message_sid, created_at DESC)`
- `sms_events_created_idx` on `(created_at DESC)`
- `sms_events_status_idx` on `(message_status)`

---

### org_intake_policies
- **id** (uuid, pk, default `gen_random_uuid()`)
- org_slug (text, not null)
- species_slug (text, not null, fk → `species_meta.slug` on delete **cascade**)
- intake_status (text, not null; **check**: one of `'accept' | 'conditional' | 'not_supported'`)
- policy_notes (text, null)
- public_message (text, null)
- referrals (jsonb, default `[]`)
- last_reviewed_at (timestamptz, default `now()`)

**Constraints**
- Unique `(org_slug, species_slug)`

**Indexes**
- `org_intake_policies_org_slug_idx` on `(org_slug)`
- `org_intake_policies_species_slug_idx` on `(species_slug)`

---

### out_of_scope_species
- **slug** (text, pk)
- display_name (text, not null)
- public_message (text, not null)
- referrals (jsonb, not null, default `[]`)
- last_reviewed_at (timestamptz, default `now()`)

---

### species_aliases
- **alias** (text, pk)
- canonical_slug (text, not null, fk → `species_meta.slug` on delete **cascade**)

---

### species_meta
- **id** (uuid, pk, default `gen_random_uuid()`)
- common_name (text, not null)
- scientific_name (text, null)
- category (text, null)
- rabies_vector (boolean, not null, default `false`)
- dangerous (boolean, not null, default `false`)
- referral_required (boolean, not null, default `false`)
- intervention_note (text, null)
- tags (jsonb, not null, default `[]`)
- photo_url (text, null)
- created_at (timestamptz, not null, default `now()`)
- slug (text, not null, **unique**)
- intervention_needed (text, null)
- referral_required_level (text, null)
- dangerous_level (text, null)
- rabies_vector_level (text, null)
- needs_species_escalation_level (text, null)
- bat_exposure_level (text, null)
- potential_aggression (text, null)
- age_assessment_needed (boolean, null)
- description (text, null)
- keywords (jsonb, null)
- care_advice (text, null)

**Indexes**
- Unique (case-insensitive) on `lower(common_name)` → `species_meta_common_name_key`
- `species_meta_category_idx` on `(category)`
- `species_meta_slug_ci_idx` on `(lower(slug))`

---

## Legacy / Experimental Tables
*(Kept for future KB/retrieval; not active product features today.)*

### documents
- **id** (uuid, pk, default `gen_random_uuid()`)
- user_id (text, not null)
- name (text, not null)
- mime (text, not null)
- size_bytes (integer, not null)
- storage_path (text, not null)
- created_at (timestamptz, not null, default `now()`)

**Indexes**
- _(none beyond PK in snapshot)_

---

### document_chunks
- **id** (uuid, pk, default `gen_random_uuid()`)
- document_id (uuid, fk → `documents.id` on delete **cascade**)
- chunk_index (integer, not null)
- content (text, not null)
- embedding (`extensions.vector`, not null)

**Indexes**
- `document_chunks_doc_idx` on `(document_id, chunk_index)`
- `document_chunks_embedding_hnsw` on `embedding` using **HNSW** (pgvector L2)

---

### memory
- **id** (uuid, pk, default `gen_random_uuid()`)
- user_id (text, not null)
- content (text, not null)
- embedding (`extensions.vector`, not null)
- created_at (timestamptz, default `now()`)

**Indexes**
- `memory_embedding_hnsw` on `embedding` using **HNSW** (pgvector L2)
- `memory_user_created_idx` on `(user_id, created_at DESC)`

---

## Views

### conversation_activity
- `conversation_id` (uuid), `last_activity` (timestamptz), `message_count` (int)  
- Left-joins messages to compute last activity & count per conversation.

### sms_event_latest
- For each `message_sid`, exposes the latest `(message_status, error_code, error_message, created_at)` by `created_at DESC`.

### species_meta_lookup
- Flattens `species_meta` into normalized, **coalesced** flags:  
  `intervention_needed`, `referral_required`, `dangerous`, `rabies_vector`,  
  `needs_species_escalation`, `bat_exposure`, `potential_aggression`, `age_assessment_needed`.  
- Uses text levels when available; falls back to boolean fields.

---

## Row-Level Security (RLS)

**Enabled on**
- `species_aliases` (RLS enabled)
- `species_meta` (RLS enabled)

**Policies**
- `species_aliases_select_all`: **permissive**, `SELECT`, `to public`, `using (true)`
- `species_meta_select_all`: **permissive**, `SELECT`, `to public`, `using (true)`

> No INSERT/UPDATE/DELETE policies defined in snapshot.

---

## Enums / Types
- **Application-defined enums in `public`:** _none_ (snapshot date).  
- System enums (auth/realtime/storage) exist but are managed by Supabase; documented in comments only in `SCHEMA.sql`.

---

## Functions / Triggers

**Functions (public)**
- `match_doc_chunks_l2(query_embedding vector, for_user text, match_count int=8)` → returns `(document_id, chunk_index, content, distance)` using **L2** distance over `document_chunks.embedding`; joins `documents` filtered by `user_id`.
- `match_memories_l2(query_embedding vector, for_user text, match_count int=5)` → returns `(id, content, distance)` from `memory.embedding` using **L2** distance and `user_id` filter.

**Triggers**
- _None_ in `public` (snapshot date).

---

## Indexes (at-a-glance)
- **conversations:** user, channel
- **conversation_messages:** conversation_id, message_sid
- **web_conversation_cookies:** conversation_id
- **sms_events:** message_sid, created_at (several variants), status; unique `(message_sid, message_status, error_code)`
- **org_intake_policies:** org_slug, species_slug
- **species_meta:** lower(common_name) unique, category, lower(slug)
- **document_chunks:** (document_id, chunk_index), HNSW on embedding
- **memory:** HNSW on embedding; (user_id, created_at DESC)

---

## Maintenance Ritual
1. Make a schema change in Supabase Studio (SQL Editor).  
2. Paste the **exact SQL** into `db/CHANGES/YYYY-MM-DD_<desc>.sql`.  
3. Update `db/SCHEMA.sql` to reflect the new state (tables/indexes/views/policies/functions).  
4. Mirror key changes here.  
5. Commit & push.
