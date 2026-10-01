CREATE TYPE "public"."channelProfiles_linkTolerance_enum" AS ENUM('unknown', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."channelProfiles_moderationLevel_enum" AS ENUM('unknown', 'light', 'medium', 'strict');--> statement-breakpoint
CREATE TYPE "public"."chatAttachments_kind_enum" AS ENUM('image', 'pdf', 'audio');--> statement-breakpoint
CREATE TYPE "public"."chatMessages_role_enum" AS ENUM('user', 'assistant', 'tool');--> statement-breakpoint
CREATE TYPE "public"."commentObservations_classification_enum" AS ENUM('noise', 'conversation', 'exposure', 'help_request', 'risk');--> statement-breakpoint
CREATE TYPE "public"."commentObservations_riskLevel_enum" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."commentObservations_source_enum" AS ENUM('youtube_api', 'apify', 'manual', 'demo');--> statement-breakpoint
CREATE TYPE "public"."drafts_riskLevel_enum" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."drafts_status_enum" AS ENUM('drafted', 'review', 'edited', 'approved', 'discarded', 'publishing', 'published', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."drafts_type_enum" AS ENUM('A_video', 'B_reply', 'C_link');--> statement-breakpoint
CREATE TYPE "public"."editorialFeedback_outcome_enum" AS ENUM('approved', 'edited', 'discarded', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."editorialMemories_status_enum" AS ENUM('core', 'proposed', 'approved', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."projectChannels_status_enum" AS ENUM('pending', 'connected', 'reauthorization_required', 'paused', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."projectMembers_role_enum" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."projectMembers_status_enum" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."projects_status_enum" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."publicationEngagementEvents_eventType_enum" AS ENUM('reply', 'mention', 'like', 'removed', 'verified');--> statement-breakpoint
CREATE TYPE "public"."publicationOutbox_status_enum" AS ENUM('pending', 'processing', 'succeeded', 'uncertain', 'failed');--> statement-breakpoint
CREATE TYPE "public"."publications_likeStatus_enum" AS ENUM('not_applicable', 'pending_manual', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."publications_verificationStatus_enum" AS ENUM('pending', 'verified', 'failed');--> statement-breakpoint
CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."videos_eligibilityStatus_enum" AS ENUM('discovered', 'eligible', 'rejected', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."videos_riskLevel_enum" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."videos_source_enum" AS ENUM('youtube_api', 'apify', 'manual', 'demo');--> statement-breakpoint
CREATE TYPE "public"."youtubeConnections_status_enum" AS ENUM('connected', 'reauthorization_required');--> statement-breakpoint
CREATE TABLE "automationSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerOpenId" varchar(128) NOT NULL,
	"projectChannelId" integer,
	"enabled" integer DEFAULT 0 NOT NULL,
	"autoPublish" integer DEFAULT 0 NOT NULL,
	"dailyLimit" integer DEFAULT 30 NOT NULL,
	"minChannelIntervalDays" integer DEFAULT 30 NOT NULL,
	"includeLink" integer DEFAULT 1 NOT NULL,
	"searchQueries" text,
	"scheduleCronTaskUid" varchar(65),
	"lastRunAt" timestamp with time zone,
	"lastError" text,
	"pausedReason" varchar(120),
	"runLeaseUntil" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automationSettings_project_channel_unique" UNIQUE("projectChannelId")
);
--> statement-breakpoint
CREATE TABLE "chainEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"publicationId" integer,
	"eventType" varchar(80) NOT NULL,
	"source" varchar(80) NOT NULL,
	"occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "channelProfiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"channelId" varchar(128) NOT NULL,
	"channelName" varchar(255) NOT NULL,
	"invitesComments" integer DEFAULT 0 NOT NULL,
	"creatorReplies" integer DEFAULT 0 NOT NULL,
	"linkTolerance" "channelProfiles_linkTolerance_enum" DEFAULT 'unknown' NOT NULL,
	"moderationLevel" "channelProfiles_moderationLevel_enum" DEFAULT 'unknown' NOT NULL,
	"compatibilityScore" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"lastInteractionAt" timestamp with time zone,
	CONSTRAINT "channelProfiles_channelId_unique" UNIQUE("channelId")
);
--> statement-breakpoint
CREATE TABLE "chatAttachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"messageId" integer NOT NULL,
	"ownerOpenId" varchar(128) NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"mimeType" varchar(120) NOT NULL,
	"kind" "chatAttachments_kind_enum" NOT NULL,
	"sizeBytes" integer NOT NULL,
	"storageKey" varchar(500) NOT NULL,
	"storageUrl" varchar(800) NOT NULL,
	"transcript" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatConversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerOpenId" varchar(128) NOT NULL,
	"title" varchar(180) DEFAULT 'Nova conversa' NOT NULL,
	"archived" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerOpenId" varchar(128) NOT NULL,
	"conversationId" integer,
	"role" "chatMessages_role_enum" NOT NULL,
	"content" text NOT NULL,
	"toolName" varchar(120),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commentObservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"videoId" integer NOT NULL,
	"youtubeCommentId" varchar(128) NOT NULL,
	"authorPublicId" varchar(255),
	"text" text NOT NULL,
	"likeCount" integer DEFAULT 0 NOT NULL,
	"publishedAt" timestamp with time zone,
	"classification" "commentObservations_classification_enum" DEFAULT 'noise' NOT NULL,
	"riskLevel" "commentObservations_riskLevel_enum" DEFAULT 'low' NOT NULL,
	"exposureSignals" text,
	"source" "commentObservations_source_enum" DEFAULT 'demo' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commentObservations_youtubeCommentId_unique" UNIQUE("youtubeCommentId")
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"videoId" integer NOT NULL,
	"projectChannelId" integer,
	"parentCommentId" varchar(128),
	"type" "drafts_type_enum" NOT NULL,
	"text" text NOT NULL,
	"containsLink" integer DEFAULT 0 NOT NULL,
	"utmUrl" varchar(1000),
	"quoteVideo" text,
	"quoteComment" text,
	"riskLevel" "drafts_riskLevel_enum" DEFAULT 'low' NOT NULL,
	"similarityScore" integer DEFAULT 0 NOT NULL,
	"justification" text,
	"model" varchar(120) DEFAULT 'ruleset-demo' NOT NULL,
	"status" "drafts_status_enum" DEFAULT 'review' NOT NULL,
	"dedupeKey" varchar(512),
	"createdBy" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drafts_dedupeKey_unique" UNIQUE("dedupeKey")
);
--> statement-breakpoint
CREATE TABLE "editorialFeedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"draftId" integer NOT NULL,
	"ownerId" integer,
	"outcome" "editorialFeedback_outcome_enum" NOT NULL,
	"originalText" text NOT NULL,
	"finalText" text,
	"changeSummary" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorialMemories" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerOpenId" varchar(128) NOT NULL,
	"category" varchar(80) NOT NULL,
	"title" varchar(180) NOT NULL,
	"content" text NOT NULL,
	"status" "editorialMemories_status_enum" DEFAULT 'proposed' NOT NULL,
	"locked" integer DEFAULT 0 NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"source" varchar(120) DEFAULT 'human_feedback' NOT NULL,
	"createdBy" integer,
	"reviewedBy" integer,
	"reviewedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorialMemories_owner_title_unique" UNIQUE("ownerOpenId","title")
);
--> statement-breakpoint
CREATE TABLE "editorialMemoryEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"memoryId" integer NOT NULL,
	"ownerOpenId" varchar(128) NOT NULL,
	"action" varchar(40) NOT NULL,
	"actorOpenId" varchar(128) NOT NULL,
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projectChannels" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"channelId" varchar(128) NOT NULL,
	"channelName" varchar(255) NOT NULL,
	"status" "projectChannels_status_enum" DEFAULT 'pending' NOT NULL,
	"minInteractionIntervalDays" integer DEFAULT 30 NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projectChannels_project_channel_unique" UNIQUE("projectId","channelId")
);
--> statement-breakpoint
CREATE TABLE "projectMembers" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"openId" varchar(128) NOT NULL,
	"role" "projectMembers_role_enum" DEFAULT 'owner' NOT NULL,
	"status" "projectMembers_status_enum" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projectMembers_project_openId_unique" UNIQUE("projectId","openId")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(180) NOT NULL,
	"status" "projects_status_enum" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "publicationEngagementEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"publicationId" integer NOT NULL,
	"eventType" "publicationEngagementEvents_eventType_enum" NOT NULL,
	"externalEventId" varchar(180),
	"occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" text,
	CONSTRAINT "publicationEngagementEvents_external_unique" UNIQUE("eventType","externalEventId")
);
--> statement-breakpoint
CREATE TABLE "publicationOutbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"draftId" integer NOT NULL,
	"ownerOpenId" varchar(128) NOT NULL,
	"projectChannelId" integer,
	"idempotencyKey" varchar(180) NOT NULL,
	"status" "publicationOutbox_status_enum" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"nextAttemptAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lockedUntil" timestamp with time zone,
	"youtubeCommentId" varchar(128),
	"lastError" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publicationOutbox_draftId_unique" UNIQUE("draftId"),
	CONSTRAINT "publicationOutbox_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" serial PRIMARY KEY NOT NULL,
	"draftId" integer NOT NULL,
	"videoId" integer NOT NULL,
	"projectChannelId" integer,
	"youtubeCommentId" varchar(128),
	"parentCommentId" varchar(128),
	"publishedAt" timestamp with time zone,
	"verificationStatus" "publications_verificationStatus_enum" DEFAULT 'pending' NOT NULL,
	"likeStatus" "publications_likeStatus_enum" DEFAULT 'pending_manual' NOT NULL,
	"replyCount" integer DEFAULT 0 NOT NULL,
	"removedStatus" integer DEFAULT 0 NOT NULL,
	"errorCode" varchar(120),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "readingVisits" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitToken" varchar(80) NOT NULL,
	"source" varchar(80) DEFAULT 'direct' NOT NULL,
	"campaign" varchar(120) DEFAULT 'none' NOT NULL,
	"videoReference" varchar(200) DEFAULT 'unknown' NOT NULL,
	"secondsRead" integer DEFAULT 0 NOT NULL,
	"completed" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readingVisits_visitToken_unique" UNIQUE("visitToken")
);
--> statement-breakpoint
CREATE TABLE "rulesets" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" varchar(40) NOT NULL,
	"documentSource" varchar(255) NOT NULL,
	"rulesJson" text NOT NULL,
	"active" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rulesets_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "users_role_enum" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "videoMetricSnapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"videoId" integer NOT NULL,
	"viewCount" integer DEFAULT 0 NOT NULL,
	"commentCount" integer DEFAULT 0 NOT NULL,
	"likeCount" integer DEFAULT 0 NOT NULL,
	"opportunityScore" integer DEFAULT 0 NOT NULL,
	"capturedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"youtubeVideoId" varchar(32) NOT NULL,
	"url" varchar(500) NOT NULL,
	"title" text NOT NULL,
	"channelId" varchar(128) NOT NULL,
	"channelName" varchar(255) NOT NULL,
	"publishedAt" timestamp with time zone,
	"durationSeconds" integer DEFAULT 0 NOT NULL,
	"isShort" integer DEFAULT 0 NOT NULL,
	"viewCount" integer DEFAULT 0 NOT NULL,
	"commentCount" integer DEFAULT 0 NOT NULL,
	"language" varchar(12) DEFAULT 'es' NOT NULL,
	"niche" varchar(120),
	"description" text,
	"source" "videos_source_enum" DEFAULT 'demo' NOT NULL,
	"eligibilityStatus" "videos_eligibilityStatus_enum" DEFAULT 'discovered' NOT NULL,
	"relevanceScore" integer DEFAULT 0 NOT NULL,
	"riskLevel" "videos_riskLevel_enum" DEFAULT 'low' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_youtubeVideoId_unique" UNIQUE("youtubeVideoId")
);
--> statement-breakpoint
CREATE TABLE "youtubeConnections" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerOpenId" varchar(128) NOT NULL,
	"projectChannelId" integer,
	"channelId" varchar(128) NOT NULL,
	"channelName" varchar(255) NOT NULL,
	"accessTokenEncrypted" text NOT NULL,
	"refreshTokenEncrypted" text NOT NULL,
	"tokenExpiresAt" timestamp with time zone,
	"scopes" text,
	"status" "youtubeConnections_status_enum" DEFAULT 'connected' NOT NULL,
	"lastError" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "youtubeConnections_project_channel_unique" UNIQUE("projectChannelId")
);
--> statement-breakpoint
ALTER TABLE "automationSettings" ADD CONSTRAINT "automationSettings_project_channel_fk" FOREIGN KEY ("projectChannelId") REFERENCES "public"."projectChannels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chainEvents" ADD CONSTRAINT "chainEvents_publication_fk" FOREIGN KEY ("publicationId") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatAttachments" ADD CONSTRAINT "chatAttachments_message_fk" FOREIGN KEY ("messageId") REFERENCES "public"."chatMessages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatMessages" ADD CONSTRAINT "chatMessages_conversation_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."chatConversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commentObservations" ADD CONSTRAINT "commentObservations_video_fk" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_video_fk" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_project_channel_fk" FOREIGN KEY ("projectChannelId") REFERENCES "public"."projectChannels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_owner_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorialFeedback" ADD CONSTRAINT "editorialFeedback_draft_fk" FOREIGN KEY ("draftId") REFERENCES "public"."drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorialFeedback" ADD CONSTRAINT "editorialFeedback_owner_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorialMemories" ADD CONSTRAINT "editorialMemories_creator_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorialMemories" ADD CONSTRAINT "editorialMemories_reviewer_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorialMemoryEvents" ADD CONSTRAINT "editorialMemoryEvents_memory_fk" FOREIGN KEY ("memoryId") REFERENCES "public"."editorialMemories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projectChannels" ADD CONSTRAINT "projectChannels_project_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projectMembers" ADD CONSTRAINT "projectMembers_project_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicationEngagementEvents" ADD CONSTRAINT "publicationEngagementEvents_publication_fk" FOREIGN KEY ("publicationId") REFERENCES "public"."publications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicationOutbox" ADD CONSTRAINT "publicationOutbox_draft_fk" FOREIGN KEY ("draftId") REFERENCES "public"."drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicationOutbox" ADD CONSTRAINT "publicationOutbox_project_channel_fk" FOREIGN KEY ("projectChannelId") REFERENCES "public"."projectChannels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_draft_fk" FOREIGN KEY ("draftId") REFERENCES "public"."drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_video_fk" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_project_channel_fk" FOREIGN KEY ("projectChannelId") REFERENCES "public"."projectChannels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videoMetricSnapshots" ADD CONSTRAINT "videoMetricSnapshots_video_fk" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtubeConnections" ADD CONSTRAINT "youtubeConnections_project_channel_fk" FOREIGN KEY ("projectChannelId") REFERENCES "public"."projectChannels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automationSettings_owner_idx" ON "automationSettings" USING btree ("ownerOpenId");--> statement-breakpoint
CREATE INDEX "automationSettings_scheduleCronTaskUid_idx" ON "automationSettings" USING btree ("scheduleCronTaskUid");--> statement-breakpoint
CREATE INDEX "chatAttachments_message_idx" ON "chatAttachments" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "chatConversations_owner_updated_idx" ON "chatConversations" USING btree ("ownerOpenId","updatedAt");--> statement-breakpoint
CREATE INDEX "chatMessages_owner_created_idx" ON "chatMessages" USING btree ("ownerOpenId","createdAt");--> statement-breakpoint
CREATE INDEX "chatMessages_conversation_created_idx" ON "chatMessages" USING btree ("conversationId","createdAt");--> statement-breakpoint
CREATE INDEX "drafts_project_channel_idx" ON "drafts" USING btree ("projectChannelId");--> statement-breakpoint
CREATE INDEX "editorialFeedback_draft_created_idx" ON "editorialFeedback" USING btree ("draftId","createdAt");--> statement-breakpoint
CREATE INDEX "editorialMemories_owner_status_idx" ON "editorialMemories" USING btree ("ownerOpenId","status");--> statement-breakpoint
CREATE INDEX "editorialMemoryEvents_memory_created_idx" ON "editorialMemoryEvents" USING btree ("memoryId","createdAt");--> statement-breakpoint
CREATE INDEX "projectChannels_project_status_idx" ON "projectChannels" USING btree ("projectId","status");--> statement-breakpoint
CREATE INDEX "projectMembers_project_status_idx" ON "projectMembers" USING btree ("projectId","status");--> statement-breakpoint
CREATE INDEX "publicationEngagementEvents_publication_event_idx" ON "publicationEngagementEvents" USING btree ("publicationId","eventType");--> statement-breakpoint
CREATE INDEX "publicationOutbox_status_next_attempt_idx" ON "publicationOutbox" USING btree ("status","nextAttemptAt");--> statement-breakpoint
CREATE INDEX "publicationOutbox_project_channel_idx" ON "publicationOutbox" USING btree ("projectChannelId");--> statement-breakpoint
CREATE INDEX "publications_project_channel_idx" ON "publications" USING btree ("projectChannelId");--> statement-breakpoint
CREATE INDEX "readingVisits_source_created_idx" ON "readingVisits" USING btree ("source","createdAt");--> statement-breakpoint
CREATE INDEX "videoMetricSnapshots_video_captured_idx" ON "videoMetricSnapshots" USING btree ("videoId","capturedAt");--> statement-breakpoint
CREATE INDEX "youtubeConnections_owner_idx" ON "youtubeConnections" USING btree ("ownerOpenId");