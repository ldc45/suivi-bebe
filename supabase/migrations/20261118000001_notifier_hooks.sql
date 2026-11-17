-- Déclenchement de la fonction « notifier » par la base elle-même (remplace webhook et cron à configurer à la main).
-- - À chaque saisie créée ou modifiée : appel de la fonction (prévenir l'autre parent).
-- - Chaque minute, seulement s'il existe un biberon préparé : appel de la fonction (rappels).
-- Les appels portent un secret tiré au hasard par la base (notifier_settings), que seule la fonction peut lire.
-- Pour un autre projet Supabase, remplacer l'adresse de la fonction ci-dessous.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.notifier_settings (
  id      int primary key default 1 check (id = 1),
  url     text not null,
  secret  text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
alter table public.notifier_settings enable row level security;  -- aucune règle : invisible depuis l'appli

insert into public.notifier_settings (id, url)
values (1, 'https://kwswfkqwercubgansrcu.supabase.co/functions/v1/notifier')
on conflict (id) do update set url = excluded.url;

-- Appel asynchrone (pg_net) : n'attend pas la réponse et ne bloque jamais une saisie.
create or replace function public.notifier_call(payload jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare s record;
begin
  select url, secret into s from public.notifier_settings where id = 1;
  if s.url is null then return; end if;
  perform net.http_post(
    url := s.url,
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notifier-secret', s.secret),
    timeout_milliseconds := 5000
  );
end; $$;
revoke all on function public.notifier_call(jsonb) from public, anon, authenticated;

create or replace function public.entries_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.notifier_call(jsonb_build_object(
      'type', tg_op, 'table', tg_table_name,
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) end
    ));
  exception when others then
    null;  -- une notification manquée ne doit jamais empêcher d'enregistrer une saisie
  end;
  return null;
end; $$;
revoke all on function public.entries_notify() from public, anon, authenticated;

drop trigger if exists entries_notify on public.entries;
create trigger entries_notify after insert or update on public.entries
for each row execute function public.entries_notify();

-- Rappels des biberons préparés : chaque minute, mais seulement quand il y en a un en attente.
select cron.unschedule(jobid) from cron.job where jobname = 'notifier-biberons';
select cron.schedule('notifier-biberons', '* * * * *', $cron$
  select public.notifier_call('{"kind":"tick"}'::jsonb)
  where exists (select 1 from public.entries where type = 'bottle' and in_progress and started_at > now() - interval '1 day')
$cron$);
