-- Notifications : prénom des parents, téléphones abonnés, registre des rappels envoyés.
-- À lancer une fois dans Supabase (SQL Editor). Peut être relancé sans risque. Ne modifie aucune saisie.

-- Prénom et compte de chaque membre --------------------------------------------
alter table public.household_members add column if not exists display_name text
  check (display_name is null or char_length(display_name) between 1 and 40);
alter table public.household_members add column if not exists user_id uuid;

-- Un membre ne modifie que son prénom, via cette fonction (jamais son adresse, son foyer ou son rôle).
-- Elle relie aussi la ligne du membre à son compte, pour afficher « par Ludo » sur les saisies.
create or replace function public.set_my_name(name text)
returns void language sql security definer set search_path = public as $$
  update public.household_members
     set display_name = nullif(trim(name), ''), user_id = auth.uid()
   where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Relie le compte connecté à sa ligne de membre, sans toucher au prénom (appelé à l'ouverture de l'appli).
create or replace function public.link_my_account()
returns void language sql security definer set search_path = public as $$
  update public.household_members
     set user_id = auth.uid()
   where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and user_id is distinct from auth.uid();
$$;

revoke all on function public.set_my_name(text) from public, anon;
revoke all on function public.link_my_account() from public, anon;
grant execute on function public.set_my_name(text) to authenticated;
grant execute on function public.link_my_account() to authenticated;

-- Téléphones abonnés aux notifications --------------------------------------------
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  endpoint      text not null unique check (char_length(endpoint) < 1000),
  p256dh        text not null check (char_length(p256dh) < 200),
  auth          text not null check (char_length(auth) < 100),
  -- bottle : rappels des biberons préparés ; other : 'all' | 'important' | 'none' (ce que fait l'autre parent)
  prefs         jsonb not null default '{"bottle": true, "other": "all"}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists push_subscriptions_household_idx on public.push_subscriptions (household_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists "abonné : ses téléphones" on public.push_subscriptions;
create policy "abonné : ses téléphones" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_household_member(household_id));

-- Réservé à la fonction « notifier » (aucune règle d'accès : invisible depuis l'appli) ------------------
-- Clés de chiffrement des notifications, créées par la fonction au premier appel.
create table if not exists public.push_config (
  id           int primary key default 1 check (id = 1),
  public_key   text not null,
  private_key  text not null,
  created_at   timestamptz not null default now()
);
alter table public.push_config enable row level security;

-- Rappels déjà envoyés (biberon bientôt à jeter, à jeter), pour ne jamais les envoyer deux fois.
create table if not exists public.push_sent (
  entry_id  uuid not null references public.entries (id) on delete cascade,
  kind      text not null,
  sent_at   timestamptz not null default now(),
  primary key (entry_id, kind)
);
alter table public.push_sent enable row level security;
