-- Cadena Invisible: hardening das funções de trigger contra search_path mutável.
-- Não altera dados; apenas fixa a resolução de objetos em public e pg_temp.
BEGIN;
ALTER FUNCTION public.enforce_project_channel_slot_limit() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_youtube_connection_channel_scope() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_draft_channel_scope() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_publication_channel_scope() SET search_path = public, pg_temp;
COMMIT;
