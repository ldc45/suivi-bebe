-- Auteur d'une saisie fixé par la base, et non par le téléphone (audit de sécurité, point 6).
-- À la création : le compte connecté (auth.uid()), quoi que la requête envoie.
-- À la modification : l'auteur d'origine est conservé (« ajouté par l'autre parent » ne peut pas être falsifié).
-- Sans effet sur les saisies existantes. Peut être relancé sans risque.

create or replace function public.entries_set_author()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
  end if;
  return new;
end; $$;

drop trigger if exists entries_author on public.entries;
create trigger entries_author before insert or update on public.entries
for each row execute function public.entries_set_author();
