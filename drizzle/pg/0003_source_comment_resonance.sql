-- Persist community-resonance signals for source comments.
-- Non-destructive: existing observations receive safe zero defaults.
ALTER TABLE public."commentObservations"
  ADD COLUMN IF NOT EXISTS "replyCount" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "resonanceScore" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "commentObservations_resonance_idx"
  ON public."commentObservations" ("videoId", "resonanceScore" DESC, "likeCount" DESC, "replyCount" DESC);
