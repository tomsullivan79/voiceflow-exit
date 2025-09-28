-- DB Schema (DDL snapshot) — Source of Truth
-- Exported manually from Supabase Studio on: 2025-09-27 CT
-- Notes:
-- - Paste exact CREATE statements from Studio (tables, indexes, views, policies).
-- - Record future edits in db/CHANGES/*.sql and keep this file in sync.

-- ============================
-- Tables
-- ============================

-- conversations
create table public.conversations (
  id uuid not null default gen_random_uuid (),
  user_id text not null,
  channel text not null default 'sms'::text,
  phone text null,
  title text null default 'Conversation'::text,
  status text not null default 'open'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  closed_at timestamp with time zone null,
  created_ip text null,
  constraint conversations_pkey primary key (id)
) TABLESPACE pg_default;

-- (add other tables below this in future steps)
-- e.g.
-- create table public.conversation_messages ( ... );
-- create table public.web_conversation_cookies ( ... );
-- create table public.sms_events ( ... );

-- ============================
-- Indexes (beyond those inside CREATE TABLE)
-- ============================

-- conversations
create index IF not exists idx_conversations_user on public.conversations using btree (user_id) TABLESPACE pg_default;
create index IF not exists idx_conversations_channel on public.conversations using btree (channel) TABLESPACE pg_default;

-- (add indexes for other tables here as you paste their DDL)

-- ============================
-- Views
-- ============================

-- (paste CREATE VIEW statements, e.g., conversation_activity)

-- ============================
-- Row-Level Security Policies (if any)
-- ============================

-- (paste CREATE POLICY statements)

-- ============================
-- Enums / Types (if any)
-- ============================

-- (paste CREATE TYPE statements)

-- ============================
-- Triggers / Functions (if any)
-- ============================

-- (paste CREATE FUNCTION / CREATE TRIGGER statements)
