-- 19D-1A — Create public_health_contacts (region-scoped contact directory for dispatch cases)
-- Date: 2025-09-30
-- Notes:
-- - Idempotent guards used where possible.
-- - RLS: public SELECT allowed; service-role key will handle writes.

create extension if not exists pgcrypto;

-- 1) Table
create table if not exists public.public_health_contacts (
  id uuid primary key default gen_random_uuid(),
  region_type text not null check (region_type in ('zip','county')),
  region_value text not null,              -- e.g., '55414' or 'Hennepin County'
  name text not null,                      -- org or department name
  phone text,                              -- canonical dialable string
  url text,                                -- canonical info page
  hours text,                              -- human text (e.g., 'Mon–Fri 8–5')
  notes text,                              -- freeform notes / routing tips
  priority int not null default 10,        -- lower = preferred
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Indexes
create index if not exists idx_phc_active_region
  on public.public_health_contacts (active, region_type, region_value, priority);

create index if not exists idx_phc_region_value
  on public.public_health_contacts (region_value);

create unique index if not exists ux_phc_region_name_active
  on public.public_health_contacts (region_type, region_value, name)
  where active = true;

-- 3) updated_at trigger
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_phc_updated_at on public.public_health_contacts;
create trigger trg_phc_updated_at
  before update on public.public_health_contacts
  for each row execute function public.set_updated_at();

-- 4) RLS (public read; writes via service key)
alter table public.public_health_contacts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public'
      and tablename='public_health_contacts' and policyname='phc_public_read'
  ) then
    create policy phc_public_read
      on public.public_health_contacts
      for select
      using (true);
  end if;
end$$;

-- 5) Seed examples (optional; safe if already present)
insert into public.public_health_contacts (region_type, region_value, name, phone, url, hours, notes, priority)
values
  ('county','Hennepin County','Hennepin County Public Health', '612-348-8900',
   'https://www.hennepin.us/public-health', 'Mon–Fri 8–5',
   'Ask for animal exposure/rabies guidance; after-hours route via dispatch.', 1),
  ('zip','55414','Minneapolis 311 / Animal Care & Control', '612-673-6222',
   'https://www.minneapolismn.gov/resident-services/animals-pets/', 'Daily 7–7',
   'If bat found inside sleeping area, isolate room and call.', 2)
on conflict do nothing;
