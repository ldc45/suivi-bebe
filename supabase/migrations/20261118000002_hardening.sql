-- Corrections signalées par le contrôle de sécurité de Supabase (sans effet sur l'appli).
alter function public.touch_updated_at() set search_path = public;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
