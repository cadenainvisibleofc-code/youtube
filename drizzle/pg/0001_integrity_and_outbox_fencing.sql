-- Cadena Invisible: hardening incremental sobre o schema PostgreSQL já aplicado.
-- Não faz backfill, não apaga dados e falha se houver inconsistências existentes.

BEGIN;

-- Cobertura de FKs usadas em joins, deletes RESTRICT e reconciliação.
CREATE INDEX IF NOT EXISTS "chainEvents_publication_fk_idx" ON public."chainEvents" ("publicationId");
CREATE INDEX IF NOT EXISTS "commentObservations_video_fk_idx" ON public."commentObservations" ("videoId");
CREATE INDEX IF NOT EXISTS "drafts_owner_fk_idx" ON public."drafts" ("createdBy");
CREATE INDEX IF NOT EXISTS "drafts_video_fk_idx" ON public."drafts" ("videoId");
CREATE INDEX IF NOT EXISTS "editorialFeedback_owner_fk_idx" ON public."editorialFeedback" ("ownerId");
CREATE INDEX IF NOT EXISTS "editorialMemories_creator_fk_idx" ON public."editorialMemories" ("createdBy");
CREATE INDEX IF NOT EXISTS "editorialMemories_reviewer_fk_idx" ON public."editorialMemories" ("reviewedBy");
CREATE INDEX IF NOT EXISTS "publications_draft_fk_idx" ON public."publications" ("draftId");
CREATE INDEX IF NOT EXISTS "publications_video_fk_idx" ON public."publications" ("videoId");

-- Um draft aprovado pode gerar uma única publicação local.
CREATE UNIQUE INDEX IF NOT EXISTS "publications_draft_unique" ON public."publications" ("draftId");

-- Fencing da outbox: worker antigo não pode finalizar o item após perder o lease.
ALTER TABLE public."publicationOutbox"
  ADD COLUMN IF NOT EXISTS "leaseToken" varchar(64),
  ADD COLUMN IF NOT EXISTS "leaseVersion" integer NOT NULL DEFAULT 0;

-- Limite estrutural de cinco slots não revogados por projeto.
CREATE OR REPLACE FUNCTION public.enforce_project_channel_slot_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  occupied_slots integer;
BEGIN
  IF NEW.status <> 'revoked' THEN
    PERFORM 1 FROM public."projects" WHERE id = NEW."projectId" FOR UPDATE;
    SELECT count(*)::integer INTO occupied_slots
      FROM public."projectChannels"
     WHERE "projectId" = NEW."projectId"
       AND status <> 'revoked'
       AND id <> COALESCE(NEW.id, 0);
    IF occupied_slots >= 5 THEN
      RAISE EXCEPTION 'project_channel_limit_exceeded: project % already has five non-revoked slots', NEW."projectId" USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_channel_slot_limit_trigger ON public."projectChannels";
CREATE TRIGGER project_channel_slot_limit_trigger
BEFORE INSERT OR UPDATE OF "projectId", status ON public."projectChannels"
FOR EACH ROW EXECUTE FUNCTION public.enforce_project_channel_slot_limit();

-- Não permitir que a conexão aponte para um channelId diferente do slot.
CREATE OR REPLACE FUNCTION public.enforce_youtube_connection_channel_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_channel_id varchar(128);
BEGIN
  IF NEW."projectChannelId" IS NOT NULL THEN
    SELECT "channelId" INTO expected_channel_id FROM public."projectChannels" WHERE id = NEW."projectChannelId";
    IF expected_channel_id IS NULL OR expected_channel_id <> NEW."channelId" THEN
      RAISE EXCEPTION 'youtube_connection_channel_scope_mismatch: slot % does not match channel %', NEW."projectChannelId", NEW."channelId" USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS youtube_connection_channel_scope_trigger ON public."youtubeConnections";
CREATE TRIGGER youtube_connection_channel_scope_trigger
BEFORE INSERT OR UPDATE OF "projectChannelId", "channelId" ON public."youtubeConnections"
FOR EACH ROW EXECUTE FUNCTION public.enforce_youtube_connection_channel_scope();

-- Impedir divergência entre o canal do vídeo e o canal do slot do draft.
CREATE OR REPLACE FUNCTION public.enforce_draft_channel_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_channel_id varchar(128);
  video_channel_id varchar(128);
BEGIN
  IF NEW."projectChannelId" IS NOT NULL THEN
    SELECT "channelId" INTO expected_channel_id FROM public."projectChannels" WHERE id = NEW."projectChannelId";
    SELECT "channelId" INTO video_channel_id FROM public."videos" WHERE id = NEW."videoId";
    IF expected_channel_id IS NULL OR video_channel_id IS NULL OR expected_channel_id <> video_channel_id THEN
      RAISE EXCEPTION 'draft_channel_scope_mismatch: video % does not belong to slot %', NEW."videoId", NEW."projectChannelId" USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS draft_channel_scope_trigger ON public."drafts";
CREATE TRIGGER draft_channel_scope_trigger
BEFORE INSERT OR UPDATE OF "videoId", "projectChannelId" ON public."drafts"
FOR EACH ROW EXECUTE FUNCTION public.enforce_draft_channel_scope();

-- Outbox e publicação devem permanecer no mesmo slot do draft.
CREATE OR REPLACE FUNCTION public.enforce_publication_channel_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  draft_channel_id integer;
BEGIN
  SELECT "projectChannelId" INTO draft_channel_id FROM public."drafts" WHERE id = NEW."draftId";
  IF COALESCE(NEW."projectChannelId", -1) <> COALESCE(draft_channel_id, -1) THEN
    RAISE EXCEPTION 'publication_channel_scope_mismatch: draft % and target slot differ', NEW."draftId" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS publication_outbox_channel_scope_trigger ON public."publicationOutbox";
CREATE TRIGGER publication_outbox_channel_scope_trigger
BEFORE INSERT OR UPDATE OF "draftId", "projectChannelId" ON public."publicationOutbox"
FOR EACH ROW EXECUTE FUNCTION public.enforce_publication_channel_scope();

DROP TRIGGER IF EXISTS publication_channel_scope_trigger ON public."publications";
CREATE TRIGGER publication_channel_scope_trigger
BEFORE INSERT OR UPDATE OF "draftId", "projectChannelId" ON public."publications"
FOR EACH ROW EXECUTE FUNCTION public.enforce_publication_channel_scope();

COMMIT;
