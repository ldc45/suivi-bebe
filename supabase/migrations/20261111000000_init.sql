-- Suivi bébé : schéma initial
-- Foyers, membres, enfants, traitements et saisies, avec règles d’accès par foyer.

create extension if not exists pgcrypto;

-- Foyers et membres --------------------------------------------------------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Famille',
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id  uuid not null references public.households (id) on delete cascade,
  email         text not null,
  role          text not null default 'parent' check (role in ('parent', 'viewer')),
  created_at    timestamptz not null default now(),
  primary key (household_id, email)
);
create index household_members_email_idx on public.household_members (lower(email));

-- Enfants ------------------------------------------------------------------
create table public.babies (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households (id) on delete cascade,
  name             text not null,
  birth_date       date not null,
  sex              text check (sex in ('f', 'm')),
  birth_weight_g   integer check (birth_weight_g between 300 and 8000),
  birth_length_mm  integer check (birth_length_mm between 250 and 700),
  settings         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index babies_household_idx on public.babies (household_id);

-- Traitements (vitamine D, etc.) -------------------------------------------
create table public.medications (
  id           uuid primary key default gen_random_uuid(),
  baby_id      uuid not null references public.babies (id) on delete cascade,
  name         text not null,
  dose         text,
  frequency    text not null default 'daily' check (frequency in ('daily', 'weekly', 'as_needed')),
  time_of_day  time,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index medications_baby_idx on public.medications (baby_id);

-- Saisies ------------------------------------------------------------------
create type public.entry_type as enum (
  'bottle', 'breastfeeding', 'pumping', 'diaper', 'medication',
  'sleep', 'solid', 'temperature', 'tummy', 'growth'
);

create table public.entries (
  id             uuid primary key default gen_random_uuid(),
  baby_id        uuid not null references public.babies (id) on delete cascade,
  type           public.entry_type not null,
  started_at     timestamptz not null,
  ended_at       timestamptz,
  in_progress    boolean not null default false,
  data           jsonb not null default '{}'::jsonb,
  note           text,
  medication_id  uuid references public.medications (id) on delete set null,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index entries_baby_started_idx on public.entries (baby_id, started_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger entries_touch before update on public.entries
for each row execute function public.touch_updated_at();

-- Fonctions d’accès ----------------------------------------------------------
create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid
      and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.can_access_baby(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.babies b
    where b.id = bid and public.is_household_member(b.household_id)
  );
$$;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.can_access_baby(uuid) to authenticated;

-- Règles de sécurité (RLS) ---------------------------------------------------
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.babies            enable row level security;
alter table public.medications       enable row level security;
alter table public.entries           enable row level security;

create policy "membres : lecture du foyer" on public.households
  for select to authenticated using (public.is_household_member(id));

create policy "membres : lecture des membres" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

create policy "membres : enfants" on public.babies
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "membres : traitements" on public.medications
  for all to authenticated
  using (public.can_access_baby(baby_id))
  with check (public.can_access_baby(baby_id));

create policy "membres : saisies" on public.entries
  for all to authenticated
  using (public.can_access_baby(baby_id))
  with check (public.can_access_baby(baby_id));

-- Temps réel -------------------------------------------------------------------
alter publication supabase_realtime add table public.entries, public.babies, public.medications;
