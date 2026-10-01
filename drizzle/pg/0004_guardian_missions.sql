-- Synchronized guardian missions: one to five channel assignments,
-- human review required, at most one contextual reading link.
DO $$ BEGIN
  CREATE TYPE public."guardianMissions_status_enum" AS ENUM ('review', 'approved', 'partially_published', 'completed', 'archived', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."guardianMissions_linkPolicy_enum" AS ENUM ('none', 'exactly_one_when_multiple');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."guardianAssignments_role_enum" AS ENUM ('presence', 'perspective', 'reading');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."guardianAssignments_status_enum" AS ENUM ('review', 'approved', 'discarded', 'published', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public."guardianMissions" (
  "id" serial PRIMARY KEY,
  "ownerId" integer NOT NULL,
  "videoId" integer NOT NULL,
  "sourceCommentId" varchar(128),
  "sourceCommentText" text,
  "resonanceScore" integer NOT NULL DEFAULT 0,
  "requestedGuardianCount" integer NOT NULL CHECK ("requestedGuardianCount" BETWEEN 1 AND 5),
  "selectedGuardianCount" integer NOT NULL CHECK ("selectedGuardianCount" BETWEEN 1 AND 5),
  "linkPolicy" public."guardianMissions_linkPolicy_enum" NOT NULL DEFAULT 'exactly_one_when_multiple',
  "status" public."guardianMissions_status_enum" NOT NULL DEFAULT 'review',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "guardianMissions_owner_fk" FOREIGN KEY ("ownerId") REFERENCES public."users"("id") ON DELETE RESTRICT,
  CONSTRAINT "guardianMissions_video_fk" FOREIGN KEY ("videoId") REFERENCES public."videos"("id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public."guardianAssignments" (
  "id" serial PRIMARY KEY,
  "missionId" integer NOT NULL,
  "projectChannelId" integer NOT NULL,
  "draftId" integer NOT NULL,
  "role" public."guardianAssignments_role_enum" NOT NULL,
  "sequence" integer NOT NULL,
  "targetCommentId" varchar(128),
  "containsLink" integer NOT NULL DEFAULT 0 CHECK ("containsLink" IN (0, 1)),
  "status" public."guardianAssignments_status_enum" NOT NULL DEFAULT 'review',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "guardianAssignments_mission_fk" FOREIGN KEY ("missionId") REFERENCES public."guardianMissions"("id") ON DELETE CASCADE,
  CONSTRAINT "guardianAssignments_channel_fk" FOREIGN KEY ("projectChannelId") REFERENCES public."projectChannels"("id") ON DELETE RESTRICT,
  CONSTRAINT "guardianAssignments_draft_fk" FOREIGN KEY ("draftId") REFERENCES public."drafts"("id") ON DELETE RESTRICT,
  CONSTRAINT "guardianAssignments_mission_sequence_unique" UNIQUE ("missionId", "sequence"),
  CONSTRAINT "guardianAssignments_mission_channel_unique" UNIQUE ("missionId", "projectChannelId")
);

CREATE INDEX IF NOT EXISTS "guardianMissions_owner_idx" ON public."guardianMissions" ("ownerId");
CREATE INDEX IF NOT EXISTS "guardianMissions_video_idx" ON public."guardianMissions" ("videoId");
CREATE INDEX IF NOT EXISTS "guardianAssignments_mission_idx" ON public."guardianAssignments" ("missionId");
CREATE INDEX IF NOT EXISTS "guardianAssignments_channel_idx" ON public."guardianAssignments" ("projectChannelId");

ALTER TABLE public."guardianMissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."guardianAssignments" ENABLE ROW LEVEL SECURITY;
