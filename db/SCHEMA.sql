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


-- conversation_messages
create table public.conversation_messages (
  id bigserial not null,
  conversation_id uuid not null,
  role text not null,
  content text not null,
  created_at timestamp with time zone null default now(),
  message_sid text null,
  source_ip text null,
  constraint conversation_messages_pkey primary key (id),
  constraint conversation_messages_conversation_id_fkey foreign KEY (conversation_id) references conversations (id) on delete CASCADE
) TABLESPACE pg_default;


-- web_conversation_cookies
create table public.web_conversation_cookies (
  cookie_id uuid not null,
  conversation_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint web_conversation_cookies_pkey primary key (cookie_id),
  constraint web_conversation_cookies_conversation_id_fkey foreign KEY (conversation_id) references conversations (id) on delete CASCADE
) TABLESPACE pg_default;

-- sms_events
create table public.sms_events (
  id bigserial not null,
  message_sid text null,
  to_number text null,
  from_number text null,
  message_status text null,
  error_code text null,
  error_message text null,
  payload jsonb null,
  created_at timestamp with time zone null default now(),
  constraint sms_events_pkey primary key (id),
  constraint sms_events_sid_status_code_uniq unique (message_sid, message_status, error_code)
) TABLESPACE pg_default;

-- org_intake_policies
create table public.org_intake_policies (
  id uuid not null default gen_random_uuid (),
  org_slug text not null,
  species_slug text not null,
  intake_status text not null,
  policy_notes text null,
  public_message text null,
  referrals jsonb null default '[]'::jsonb,
  last_reviewed_at timestamp with time zone null default now(),
  constraint org_intake_policies_pkey primary key (id),
  constraint org_intake_policies_org_slug_species_slug_key unique (org_slug, species_slug),
  constraint org_intake_policies_species_slug_fkey foreign KEY (species_slug) references species_meta (slug) on delete CASCADE,
  constraint org_intake_policies_intake_status_check check (
    (
      intake_status = any (
        array[
          'accept'::text,
          'conditional'::text,
          'not_supported'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

-- out_of_scope_species
create table public.out_of_scope_species (
  slug text not null,
  display_name text not null,
  public_message text not null,
  referrals jsonb not null default '[]'::jsonb,
  last_reviewed_at timestamp with time zone null default now(),
  constraint out_of_scope_species_pkey primary key (slug)
) TABLESPACE pg_default;

-- species_aliases
create table public.species_aliases (
  alias text not null,
  canonical_slug text not null,
  constraint species_aliases_pkey primary key (alias),
  constraint species_aliases_canonical_slug_fkey foreign KEY (canonical_slug) references species_meta (slug) on delete CASCADE
) TABLESPACE pg_default;

-- species_meta
create table public.species_meta (
  id uuid not null default gen_random_uuid (),
  common_name text not null,
  scientific_name text null,
  category text null,
  rabies_vector boolean not null default false,
  dangerous boolean not null default false,
  referral_required boolean not null default false,
  intervention_note text null,
  tags jsonb not null default '[]'::jsonb,
  photo_url text null,
  created_at timestamp with time zone not null default now(),
  slug text not null,
  intervention_needed text null,
  referral_required_level text null,
  dangerous_level text null,
  rabies_vector_level text null,
  needs_species_escalation_level text null,
  bat_exposure_level text null,
  potential_aggression text null,
  age_assessment_needed boolean null,
  description text null,
  keywords jsonb null,
  care_advice text null,
  constraint species_meta_pkey primary key (id),
  constraint species_meta_slug_unique unique (slug)
) TABLESPACE pg_default;




-- ============================
-- Legacy / Experimental Tables (present in DB; not active feature code)
-- ============================

-- documents  (STATUS: legacy — kept for future KB)
-- NOTE: This is an observed snapshot. Prefer new design when KB goes GA.
-- documents
create table public.documents (
  id uuid not null default gen_random_uuid (),
  user_id text not null,
  name text not null,
  mime text not null,
  size_bytes integer not null,
  storage_path text not null,
  created_at timestamp with time zone not null default now(),
  constraint documents_pkey primary key (id)
) TABLESPACE pg_default;

-- document_chunks  (STATUS: legacy — kept for future KB)
-- NOTE: Often includes embedding columns (vector/float[]). Keep exact types.
-- document_chunks
create table public.document_chunks (
  id uuid not null default gen_random_uuid (),
  document_id uuid not null,
  chunk_index integer not null,
  content text not null,
  embedding extensions.vector not null,
  constraint document_chunks_pkey primary key (id),
  constraint document_chunks_document_id_fkey foreign KEY (document_id) references documents (id) on delete CASCADE
) TABLESPACE pg_default;

-- memory  (STATUS: legacy — transient chat memory)
-- NOTE: Decide retention & if to keep long-term. For now, document schema.
-- memory
create table public.memory (
  id uuid not null default gen_random_uuid (),
  user_id text not null,
  content text not null,
  embedding extensions.vector not null,
  created_at timestamp with time zone null default now(),
  constraint memory_pkey primary key (id)
) TABLESPACE pg_default;




-- ============================
-- Indexes (beyond those inside CREATE TABLE)
-- ============================

-- conversations
create index IF not exists idx_conversations_user on public.conversations using btree (user_id) TABLESPACE pg_default;
create index IF not exists idx_conversations_channel on public.conversations using btree (channel) TABLESPACE pg_default;

-- conversation_messages
create index IF not exists idx_conv_msgs_conv on public.conversation_messages using btree (conversation_id) TABLESPACE pg_default;
create index IF not exists idx_conversation_messages_message_sid on public.conversation_messages using btree (message_sid) TABLESPACE pg_default;

-- web_conversation_cookies
create index IF not exists web_conversation_cookies_conversation_id_idx on public.web_conversation_cookies using btree (conversation_id) TABLESPACE pg_default;

-- sms_events
create index IF not exists idx_sms_events_message_sid on public.sms_events using btree (message_sid) TABLESPACE pg_default;
create index IF not exists idx_sms_events_created_at on public.sms_events using btree (created_at desc) TABLESPACE pg_default;
create index IF not exists idx_sms_events_sid_created on public.sms_events using btree (message_sid, created_at desc) TABLESPACE pg_default;
create index IF not exists sms_events_sid_created_idx on public.sms_events using btree (message_sid, created_at desc) TABLESPACE pg_default;
create index IF not exists sms_events_created_idx on public.sms_events using btree (created_at desc) TABLESPACE pg_default;
create index IF not exists sms_events_status_idx on public.sms_events using btree (message_status) TABLESPACE pg_default;

-- org_intake_policies
create index IF not exists org_intake_policies_org_slug_idx on public.org_intake_policies using btree (org_slug) TABLESPACE pg_default;
create index IF not exists org_intake_policies_species_slug_idx on public.org_intake_policies using btree (species_slug) TABLESPACE pg_default;

-- species_aliases

-- species_meta
create unique INDEX IF not exists species_meta_common_name_key on public.species_meta using btree (lower(common_name)) TABLESPACE pg_default;
create index IF not exists species_meta_category_idx on public.species_meta using btree (category) TABLESPACE pg_default;
create index IF not exists species_meta_slug_ci_idx on public.species_meta using btree (lower(slug)) TABLESPACE pg_default;

-- ============================
-- Indexes — Legacy / Experimental
-- ============================

-- documents

-- document_chunks
create index IF not exists document_chunks_doc_idx on public.document_chunks using btree (document_id, chunk_index) TABLESPACE pg_default;
create index IF not exists document_chunks_embedding_hnsw on public.document_chunks using hnsw (embedding extensions.vector_l2_ops) TABLESPACE pg_default;

-- memory
create index IF not exists memory_embedding_hnsw on public.memory using hnsw (embedding extensions.vector_l2_ops) TABLESPACE pg_default;
create index IF not exists memory_user_created_idx on public.memory using btree (user_id, created_at desc) TABLESPACE pg_default;



-- ============================
-- Views
-- ============================

-- conversation_activity
create view public.conversation_activity as
select
  c.id as conversation_id,
  COALESCE(max(m.created_at), c.created_at) as last_activity,
  count(m.id) as message_count
from
  conversations c
  left join conversation_messages m on m.conversation_id = c.id
group by
  c.id;


-- sms_event_latest
create view public.sms_event_latest as
select distinct
  on (message_sid) message_sid,
  message_status,
  error_code,
  error_message,
  created_at
from
  sms_events
where
  message_sid is not null
order by
  message_sid,
  created_at desc;


-- species_meta_lookup
create view public.species_meta_lookup as
select
  slug,
  common_name,
  category,
  COALESCE(intervention_needed, 'conditional'::text) as intervention_needed,
  COALESCE(
    referral_required_level,
    case
      when referral_required then 'true'::text
      else 'false'::text
    end
  ) as referral_required,
  COALESCE(
    dangerous_level,
    case
      when dangerous then 'true'::text
      else 'false'::text
    end
  ) as dangerous,
  COALESCE(
    rabies_vector_level,
    case
      when rabies_vector then 'true'::text
      else 'false'::text
    end
  ) as rabies_vector,
  COALESCE(needs_species_escalation_level, 'false'::text) as needs_species_escalation,
  COALESCE(bat_exposure_level, 'false'::text) as bat_exposure,
  COALESCE(potential_aggression, 'no'::text) as potential_aggression,
  COALESCE(age_assessment_needed, false) as age_assessment_needed
from
  species_meta m;


-- ============================
-- Row-Level Security Policies
-- ============================

-- Enable RLS on tables that use policies
alter table public.species_aliases enable row level security;
alter table public.species_meta    enable row level security;
-- If you later turn on "Force RLS" in Studio, also add:
-- alter table public.species_aliases force row level security;
-- alter table public.species_meta    force row level security;

-- species_aliases — SELECT for everyone (public), permissive
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'species_aliases'
      and policyname = 'species_aliases_select_all'
  ) then
    create policy "species_aliases_select_all"
      on public.species_aliases
      as permissive
      for select
      to public
      using (true);
  else
    alter policy "species_aliases_select_all"
      on public.species_aliases
      to public
      using (true);
  end if;
end
$$;

-- species_meta — SELECT for everyone (public), permissive
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'species_meta'
      and policyname = 'species_meta_select_all'
  ) then
    create policy "species_meta_select_all"
      on public.species_meta
      as permissive
      for select
      to public
      using (true);
  else
    alter policy "species_meta_select_all"
      on public.species_meta
      to public
      using (true);
  end if;
end
$$;

-- If you later add INSERT/UPDATE/DELETE policies, append their CREATE POLICY blocks here,
-- or wrap them in similar DO $$ ... $$ guards to keep this file re-runnable.


-- ============================
-- Enums / Types (adding a comment here for testing 123)
-- ============================
-- Application-defined enums in the app schema (`public`): NONE as of 2025-09-28.
-- (The enums below live in Supabase-managed schemas and are listed here ONLY for reference.)
-- DO NOT attempt to CREATE/ALTER these here; they are provisioned by Supabase extensions.

-- --- System enums (reference only; commented out) --------------------------
-- Schema: auth
--   aal_level:                ('aal1','aal2','aal3')
--   code_challenge_method:    ('s256','plain')
--   factor_status:            ('unverified','verified')
--   factor_type:              ('totp','webauthn','phone')
--   oauth_registration_type:  ('dynamic','manual')
--   one_time_token_type:      ('confirmation_token','reauthentication_token','recovery_token',
--                              'email_change_token_new','email_change_token_current','phone_change_token')

-- Schema: realtime
--   action:                   ('INSERT','UPDATE','DELETE','TRUNCATE','ERROR')
--   equality_op:              ('eq','neq','lt','lte','gt','gte','in')

-- Schema: storage
--   buckettype:               ('STANDARD','ANALYTICS')
-- ---------------------------------------------------------------------------

-- TEMPLATE for future app enums (public):
-- create type public.<enum_name> as enum (
--   'value1',
--   'value2'
-- );
--
-- Example ALTER for adding values later (record in db/CHANGES/*.sql):
-- alter type public.<enum_name> add value if not exists 'value3' after 'value2';


-- ============================
-- Triggers / Functions
-- ============================
-- Note: Functions below rely on pgvector (`vector` type) and the legacy KB tables
--       `public.documents`, `public.document_chunks`, and `public.memory`.

-- Functions (schema: public)
-- ------------------------------------------------------------------

create or replace function public.match_doc_chunks_l2(
  query_embedding vector,
  for_user text,
  match_count integer default 8
)
returns table(
  document_id uuid,
  chunk_index integer,
  content text,
  distance double precision
)
language sql
stable
as $function$
  select
    dc.document_id,
    dc.chunk_index,
    dc.content,
    (dc.embedding <-> query_embedding) as distance
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where d.user_id = for_user
  order by dc.embedding <-> query_embedding
  limit match_count
$function$;

create or replace function public.match_memories_l2(
  query_embedding vector,
  for_user text,
  match_count integer default 5
)
returns table(
  id uuid,
  content text,
  distance double precision
)
language sql
stable
as $function$
  select
    m.id,
    m.content,
    (m.embedding <-> query_embedding) as distance
  from public.memory m
  where m.user_id = for_user
  order by m.embedding <-> query_embedding
  limit match_count
$function$;

-- Triggers (schema: public)
-- ------------------------------------------------------------------
-- None as of 2025-09-28.
