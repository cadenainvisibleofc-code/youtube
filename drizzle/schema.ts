import {
  index,
  integer,
  serial,
  foreignKey,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const usersRoleEnum = pgEnum("users_role_enum", ["user", "admin"]);
export const videosSourceEnum = pgEnum("videos_source_enum", ["youtube_api", "apify", "manual", "demo"]);
export const videosEligibilityStatusEnum = pgEnum("videos_eligibilityStatus_enum", ["discovered", "eligible", "rejected", "blocked"]);
export const videosRiskLevelEnum = pgEnum("videos_riskLevel_enum", ["low", "medium", "high", "critical"]);
export const projectsStatusEnum = pgEnum("projects_status_enum", ["active", "paused", "archived"]);
export const projectMembersRoleEnum = pgEnum("projectMembers_role_enum", ["owner", "editor", "viewer"]);
export const projectMembersStatusEnum = pgEnum("projectMembers_status_enum", ["active", "revoked"]);
export const projectChannelsStatusEnum = pgEnum("projectChannels_status_enum", ["pending", "connected", "reauthorization_required", "paused", "revoked"]);
export const channelProfilesLinkToleranceEnum = pgEnum("channelProfiles_linkTolerance_enum", ["unknown", "low", "medium", "high"]);
export const channelProfilesModerationLevelEnum = pgEnum("channelProfiles_moderationLevel_enum", ["unknown", "light", "medium", "strict"]);
export const youtubeConnectionsStatusEnum = pgEnum("youtubeConnections_status_enum", ["connected", "reauthorization_required"]);
export const commentObservationsClassificationEnum = pgEnum("commentObservations_classification_enum", ["noise", "conversation", "exposure", "help_request", "risk"]);
export const commentObservationsRiskLevelEnum = pgEnum("commentObservations_riskLevel_enum", ["low", "medium", "high", "critical"]);
export const commentObservationsSourceEnum = pgEnum("commentObservations_source_enum", ["youtube_api", "apify", "manual", "demo"]);
export const draftsTypeEnum = pgEnum("drafts_type_enum", ["A_video", "B_reply", "C_link"]);
export const draftsRiskLevelEnum = pgEnum("drafts_riskLevel_enum", ["low", "medium", "high", "critical"]);
export const draftsStatusEnum = pgEnum("drafts_status_enum", ["drafted", "review", "edited", "approved", "discarded", "publishing", "published", "blocked"]);
export const publicationsVerificationStatusEnum = pgEnum("publications_verificationStatus_enum", ["pending", "verified", "failed"]);
export const publicationsLikeStatusEnum = pgEnum("publications_likeStatus_enum", ["not_applicable", "pending_manual", "confirmed"]);
export const editorialFeedbackOutcomeEnum = pgEnum("editorialFeedback_outcome_enum", ["approved", "edited", "discarded", "blocked"]);
export const chatMessagesRoleEnum = pgEnum("chatMessages_role_enum", ["user", "assistant", "tool"]);
export const chatAttachmentsKindEnum = pgEnum("chatAttachments_kind_enum", ["image", "pdf", "audio"]);
export const publicationOutboxStatusEnum = pgEnum("publicationOutbox_status_enum", ["pending", "processing", "succeeded", "uncertain", "failed"]);
export const publicationEngagementEventsEventTypeEnum = pgEnum("publicationEngagementEvents_eventType_enum", ["reply", "mention", "like", "removed", "verified"]);
export const editorialMemoriesStatusEnum = pgEnum("editorialMemories_status_enum", ["core", "proposed", "approved", "rejected", "archived"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: usersRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  youtubeVideoId: varchar("youtubeVideoId", { length: 32 }).notNull().unique(),
  url: varchar("url", { length: 500 }).notNull(),
  title: text("title").notNull(),
  channelId: varchar("channelId", { length: 128 }).notNull(),
  channelName: varchar("channelName", { length: 255 }).notNull(),
  publishedAt: timestamp("publishedAt", { withTimezone: true }),
  durationSeconds: integer("durationSeconds").default(0).notNull(),
  isShort: integer("isShort").default(0).notNull(),
  viewCount: integer("viewCount").default(0).notNull(),
  commentCount: integer("commentCount").default(0).notNull(),
  language: varchar("language", { length: 12 }).default("es").notNull(),
  niche: varchar("niche", { length: 120 }),
  description: text("description"),
  source: videosSourceEnum("source").default("demo").notNull(),
  eligibilityStatus: videosEligibilityStatusEnum("eligibilityStatus").default("discovered").notNull(),
  relevanceScore: integer("relevanceScore").default(0).notNull(),
  riskLevel: videosRiskLevelEnum("riskLevel").default("low").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  status: projectsStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const projectMembers = pgTable("projectMembers", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  openId: varchar("openId", { length: 128 }).notNull(),
  role: projectMembersRoleEnum("role").default("owner").notNull(),
  status: projectMembersStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => ({
  projectOpenIdUnique: unique("projectMembers_project_openId_unique").on(table.projectId, table.openId),
  projectStatusIdx: index("projectMembers_project_status_idx").on(table.projectId, table.status),
  projectFk: foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], name: "projectMembers_project_fk" }).onDelete("restrict"),
}));

export const projectChannels = pgTable("projectChannels", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  channelId: varchar("channelId", { length: 128 }).notNull(),
  channelName: varchar("channelName", { length: 255 }).notNull(),
  status: projectChannelsStatusEnum("status").default("pending").notNull(),
  minInteractionIntervalDays: integer("minInteractionIntervalDays").default(30).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => ({
  projectChannelUnique: unique("projectChannels_project_channel_unique").on(table.projectId, table.channelId),
  projectStatusIdx: index("projectChannels_project_status_idx").on(table.projectId, table.status),
  projectFk: foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], name: "projectChannels_project_fk" }).onDelete("restrict"),
}));

export const channelProfiles = pgTable("channelProfiles", {
  id: serial("id").primaryKey(),
  channelId: varchar("channelId", { length: 128 }).notNull().unique(),
  channelName: varchar("channelName", { length: 255 }).notNull(),
  invitesComments: integer("invitesComments").default(0).notNull(),
  creatorReplies: integer("creatorReplies").default(0).notNull(),
  linkTolerance: channelProfilesLinkToleranceEnum("linkTolerance").default("unknown").notNull(),
  moderationLevel: channelProfilesModerationLevelEnum("moderationLevel").default("unknown").notNull(),
  compatibilityScore: integer("compatibilityScore").default(0).notNull(),
  notes: text("notes"),
  lastInteractionAt: timestamp("lastInteractionAt", { withTimezone: true }),
});

export const youtubeConnections = pgTable("youtubeConnections", {
  id: serial("id").primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 128 }).notNull(),
  projectChannelId: integer("projectChannelId"),
  channelId: varchar("channelId", { length: 128 }).notNull(),
  channelName: varchar("channelName", { length: 255 }).notNull(),
  accessTokenEncrypted: text("accessTokenEncrypted").notNull(),
  refreshTokenEncrypted: text("refreshTokenEncrypted").notNull(),
  tokenExpiresAt: timestamp("tokenExpiresAt", { withTimezone: true }),
  scopes: text("scopes"),
  status: youtubeConnectionsStatusEnum("status").default("connected").notNull(),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => ({
  projectChannelUnique: unique("youtubeConnections_project_channel_unique").on(table.projectChannelId),
  ownerIdx: index("youtubeConnections_owner_idx").on(table.ownerOpenId),
  projectChannelFk: foreignKey({ columns: [table.projectChannelId], foreignColumns: [projectChannels.id], name: "youtubeConnections_project_channel_fk" }).onDelete("restrict"),
}));

export const automationSettings = pgTable("automationSettings", {
  id: serial("id").primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 128 }).notNull(),
  projectChannelId: integer("projectChannelId"),
  enabled: integer("enabled").default(0).notNull(),
  autoPublish: integer("autoPublish").default(0).notNull(),
  dailyLimit: integer("dailyLimit").default(30).notNull(),
  minChannelIntervalDays: integer("minChannelIntervalDays").default(30).notNull(),
  includeLink: integer("includeLink").default(1).notNull(),
  searchQueries: text("searchQueries"),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastRunAt: timestamp("lastRunAt", { withTimezone: true }),
  lastError: text("lastError"),
  pausedReason: varchar("pausedReason", { length: 120 }),
  runLeaseUntil: timestamp("runLeaseUntil", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => ({
  projectChannelUnique: unique("automationSettings_project_channel_unique").on(table.projectChannelId),
  ownerIdx: index("automationSettings_owner_idx").on(table.ownerOpenId),
  scheduleCronTaskUidIdx: index("automationSettings_scheduleCronTaskUid_idx").on(table.scheduleCronTaskUid),
  projectChannelFk: foreignKey({ columns: [table.projectChannelId], foreignColumns: [projectChannels.id], name: "automationSettings_project_channel_fk" }).onDelete("restrict"),
}));

export const commentObservations = pgTable("commentObservations", {
  id: serial("id").primaryKey(),
  videoId: integer("videoId").notNull(),
  youtubeCommentId: varchar("youtubeCommentId", { length: 128 }).notNull().unique(),
  authorPublicId: varchar("authorPublicId", { length: 255 }),
  text: text("text").notNull(),
  likeCount: integer("likeCount").default(0).notNull(),
  replyCount: integer("replyCount").default(0).notNull(),
  resonanceScore: integer("resonanceScore").default(0).notNull(),
  publishedAt: timestamp("publishedAt", { withTimezone: true }),
  classification: commentObservationsClassificationEnum("classification").default("noise").notNull(),
  riskLevel: commentObservationsRiskLevelEnum("riskLevel").default("low").notNull(),
  exposureSignals: text("exposureSignals"),
  source: commentObservationsSourceEnum("source").default("demo").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  videoFk: foreignKey({ columns: [table.videoId], foreignColumns: [videos.id], name: "commentObservations_video_fk" }).onDelete("restrict"),
}));

export const drafts = pgTable("drafts", {
  id: serial("id").primaryKey(),
  videoId: integer("videoId").notNull(),
  projectChannelId: integer("projectChannelId"),
  parentCommentId: varchar("parentCommentId", { length: 128 }),
  type: draftsTypeEnum("type").notNull(),
  text: text("text").notNull(),
  containsLink: integer("containsLink").default(0).notNull(),
  utmUrl: varchar("utmUrl", { length: 1000 }),
  quoteVideo: text("quoteVideo"),
  quoteComment: text("quoteComment"),
  riskLevel: draftsRiskLevelEnum("riskLevel").default("low").notNull(),
  similarityScore: integer("similarityScore").default(0).notNull(),
  justification: text("justification"),
  model: varchar("model", { length: 120 }).default("ruleset-demo").notNull(),
  status: draftsStatusEnum("status").default("review").notNull(),
  dedupeKey: varchar("dedupeKey", { length: 512 }).unique(),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => ({
  videoFk: foreignKey({ columns: [table.videoId], foreignColumns: [videos.id], name: "drafts_video_fk" }).onDelete("restrict"),
  projectChannelIdx: index("drafts_project_channel_idx").on(table.projectChannelId),
  projectChannelFk: foreignKey({ columns: [table.projectChannelId], foreignColumns: [projectChannels.id], name: "drafts_project_channel_fk" }).onDelete("restrict"),
  ownerFk: foreignKey({ columns: [table.createdBy], foreignColumns: [users.id], name: "drafts_owner_fk" }).onDelete("set null"),
}));

export const publications = pgTable("publications", {
  id: serial("id").primaryKey(),
  draftId: integer("draftId").notNull(),
  videoId: integer("videoId").notNull(),
  projectChannelId: integer("projectChannelId"),
  youtubeCommentId: varchar("youtubeCommentId", { length: 128 }),
  parentCommentId: varchar("parentCommentId", { length: 128 }),
  publishedAt: timestamp("publishedAt", { withTimezone: true }),
  verificationStatus: publicationsVerificationStatusEnum("verificationStatus").default("pending").notNull(),
  likeStatus: publicationsLikeStatusEnum("likeStatus").default("pending_manual").notNull(),
  replyCount: integer("replyCount").default(0).notNull(),
  removedStatus: integer("removedStatus").default(0).notNull(),
  errorCode: varchar("errorCode", { length: 120 }),
  notes: text("notes"),
}, table => ({
  draftUnique: unique("publications_draft_unique").on(table.draftId),
  draftFk: foreignKey({ columns: [table.draftId], foreignColumns: [drafts.id], name: "publications_draft_fk" }).onDelete("restrict"),
  videoFk: foreignKey({ columns: [table.videoId], foreignColumns: [videos.id], name: "publications_video_fk" }).onDelete("restrict"),
  projectChannelIdx: index("publications_project_channel_idx").on(table.projectChannelId),
  projectChannelFk: foreignKey({ columns: [table.projectChannelId], foreignColumns: [projectChannels.id], name: "publications_project_channel_fk" }).onDelete("restrict"),
}));

export const editorialFeedback = pgTable("editorialFeedback", {
  id: serial("id").primaryKey(),
  draftId: integer("draftId").notNull(),
  ownerId: integer("ownerId"),
  outcome: editorialFeedbackOutcomeEnum("outcome").notNull(),
  originalText: text("originalText").notNull(),
  finalText: text("finalText"),
  changeSummary: text("changeSummary"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  draftCreatedIdx: index("editorialFeedback_draft_created_idx").on(table.draftId, table.createdAt),
  draftFk: foreignKey({ columns: [table.draftId], foreignColumns: [drafts.id], name: "editorialFeedback_draft_fk" }).onDelete("restrict"),
  ownerFk: foreignKey({ columns: [table.ownerId], foreignColumns: [users.id], name: "editorialFeedback_owner_fk" }).onDelete("set null"),
}));

export const videoMetricSnapshots = pgTable("videoMetricSnapshots", {
  id: serial("id").primaryKey(),
  videoId: integer("videoId").notNull(),
  viewCount: integer("viewCount").default(0).notNull(),
  commentCount: integer("commentCount").default(0).notNull(),
  likeCount: integer("likeCount").default(0).notNull(),
  opportunityScore: integer("opportunityScore").default(0).notNull(),
  capturedAt: timestamp("capturedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  videoCapturedIdx: index("videoMetricSnapshots_video_captured_idx").on(table.videoId, table.capturedAt),
  videoFk: foreignKey({ columns: [table.videoId], foreignColumns: [videos.id], name: "videoMetricSnapshots_video_fk" }).onDelete("cascade"),
}));

export const readingVisits = pgTable("readingVisits", {
  id: serial("id").primaryKey(),
  visitToken: varchar("visitToken", { length: 80 }).notNull().unique(),
  source: varchar("source", { length: 80 }).notNull().default("direct"),
  campaign: varchar("campaign", { length: 120 }).notNull().default("none"),
  videoReference: varchar("videoReference", { length: 200 }).notNull().default("unknown"),
  secondsRead: integer("secondsRead").default(0).notNull(),
  completed: integer("completed").default(0).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => ({
  sourceCreatedIdx: index("readingVisits_source_created_idx").on(table.source, table.createdAt),
}));

export const chainEvents = pgTable("chainEvents", {
  id: serial("id").primaryKey(),
  publicationId: integer("publicationId"),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  source: varchar("source", { length: 80 }).notNull(),
  occurredAt: timestamp("occurredAt", { withTimezone: true }).defaultNow().notNull(),
  metadata: text("metadata"),
}, table => ({
  publicationFk: foreignKey({ columns: [table.publicationId], foreignColumns: [publications.id], name: "chainEvents_publication_fk" }).onDelete("set null"),
}));

export const chatConversations = pgTable("chatConversations", {
  id: serial("id").primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 128 }).notNull(),
  title: varchar("title", { length: 180 }).notNull().default("Nova conversa"),
  archived: integer("archived").default(0).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => ({
  ownerUpdatedIdx: index("chatConversations_owner_updated_idx").on(table.ownerOpenId, table.updatedAt),
}));

export const chatMessages = pgTable("chatMessages", {
  id: serial("id").primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 128 }).notNull(),
  conversationId: integer("conversationId"),
  role: chatMessagesRoleEnum("role").notNull(),
  content: text("content").notNull(),
  toolName: varchar("toolName", { length: 120 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  ownerCreatedIdx: index("chatMessages_owner_created_idx").on(table.ownerOpenId, table.createdAt),
  conversationCreatedIdx: index("chatMessages_conversation_created_idx").on(table.conversationId, table.createdAt),
  conversationFk: foreignKey({ columns: [table.conversationId], foreignColumns: [chatConversations.id], name: "chatMessages_conversation_fk" }).onDelete("set null"),
}));

export const chatAttachments = pgTable("chatAttachments", {
  id: serial("id").primaryKey(),
  messageId: integer("messageId").notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 128 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  kind: chatAttachmentsKindEnum("kind").notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 800 }).notNull(),
  transcript: text("transcript"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  messageIdx: index("chatAttachments_message_idx").on(table.messageId),
  messageFk: foreignKey({ columns: [table.messageId], foreignColumns: [chatMessages.id], name: "chatAttachments_message_fk" }).onDelete("cascade"),
}));

export const rulesets = pgTable("rulesets", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 40 }).notNull().unique(),
  documentSource: varchar("documentSource", { length: 255 }).notNull(),
  rulesJson: text("rulesJson").notNull(),
  active: integer("active").default(0).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const publicationOutbox = pgTable("publicationOutbox", {
  id: serial("id").primaryKey(),
  draftId: integer("draftId").notNull().unique(),
  ownerOpenId: varchar("ownerOpenId", { length: 128 }).notNull(),
  projectChannelId: integer("projectChannelId"),
  idempotencyKey: varchar("idempotencyKey", { length: 180 }).notNull().unique(),
  status: publicationOutboxStatusEnum("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  leaseToken: varchar("leaseToken", { length: 64 }),
  leaseVersion: integer("leaseVersion").default(0).notNull(),
  nextAttemptAt: timestamp("nextAttemptAt", { withTimezone: true }).defaultNow().notNull(),
  lockedUntil: timestamp("lockedUntil", { withTimezone: true }),
  youtubeCommentId: varchar("youtubeCommentId", { length: 128 }),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => ({
  statusNextAttemptIdx: index("publicationOutbox_status_next_attempt_idx").on(table.status, table.nextAttemptAt),
  projectChannelIdx: index("publicationOutbox_project_channel_idx").on(table.projectChannelId),
  draftFk: foreignKey({ columns: [table.draftId], foreignColumns: [drafts.id], name: "publicationOutbox_draft_fk" }).onDelete("restrict"),
  projectChannelFk: foreignKey({ columns: [table.projectChannelId], foreignColumns: [projectChannels.id], name: "publicationOutbox_project_channel_fk" }).onDelete("restrict"),
}));

export const publicationEngagementEvents = pgTable("publicationEngagementEvents", {
  id: serial("id").primaryKey(),
  publicationId: integer("publicationId").notNull(),
  eventType: publicationEngagementEventsEventTypeEnum("eventType").notNull(),
  externalEventId: varchar("externalEventId", { length: 180 }),
  occurredAt: timestamp("occurredAt", { withTimezone: true }).defaultNow().notNull(),
  metadata: text("metadata"),
}, table => ({
  publicationEventIdx: index("publicationEngagementEvents_publication_event_idx").on(table.publicationId, table.eventType),
  externalEventUnique: unique("publicationEngagementEvents_external_unique").on(table.eventType, table.externalEventId),
  publicationFk: foreignKey({ columns: [table.publicationId], foreignColumns: [publications.id], name: "publicationEngagementEvents_publication_fk" }).onDelete("restrict"),
}));

export const editorialMemories = pgTable("editorialMemories", {
  id: serial("id").primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 128 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  content: text("content").notNull(),
  status: editorialMemoriesStatusEnum("status").default("proposed").notNull(),
  locked: integer("locked").default(0).notNull(),
  confidence: integer("confidence").default(50).notNull(),
  source: varchar("source", { length: 120 }).notNull().default("human_feedback"),
  createdBy: integer("createdBy"),
  reviewedBy: integer("reviewedBy"),
  reviewedAt: timestamp("reviewedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => ({
  ownerTitleUnique: unique("editorialMemories_owner_title_unique").on(table.ownerOpenId, table.title),
  ownerStatusIdx: index("editorialMemories_owner_status_idx").on(table.ownerOpenId, table.status),
  creatorFk: foreignKey({ columns: [table.createdBy], foreignColumns: [users.id], name: "editorialMemories_creator_fk" }).onDelete("set null"),
  reviewerFk: foreignKey({ columns: [table.reviewedBy], foreignColumns: [users.id], name: "editorialMemories_reviewer_fk" }).onDelete("set null"),
}));

export const editorialMemoryEvents = pgTable("editorialMemoryEvents", {
  id: serial("id").primaryKey(),
  memoryId: integer("memoryId").notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 128 }).notNull(),
  action: varchar("action", { length: 40 }).notNull(),
  actorOpenId: varchar("actorOpenId", { length: 128 }).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  memoryCreatedIdx: index("editorialMemoryEvents_memory_created_idx").on(table.memoryId, table.createdAt),
  memoryFk: foreignKey({ columns: [table.memoryId], foreignColumns: [editorialMemories.id], name: "editorialMemoryEvents_memory_fk" }).onDelete("restrict"),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
