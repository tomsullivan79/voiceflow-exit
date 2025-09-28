-- Change: add index for fast lookups on conversations(user_id, created_at desc)
create index if not exists idx_conversations_user_created_desc
  on public.conversations (user_id, created_at desc);
