CREATE TABLE `chainEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicationId` int,
	`eventType` varchar(80) NOT NULL,
	`source` varchar(80) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`metadata` text,
	CONSTRAINT `chainEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `channelProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` varchar(128) NOT NULL,
	`channelName` varchar(255) NOT NULL,
	`invitesComments` int NOT NULL DEFAULT 0,
	`creatorReplies` int NOT NULL DEFAULT 0,
	`linkTolerance` enum('unknown','low','medium','high') NOT NULL DEFAULT 'unknown',
	`moderationLevel` enum('unknown','light','medium','strict') NOT NULL DEFAULT 'unknown',
	`compatibilityScore` int NOT NULL DEFAULT 0,
	`notes` text,
	`lastInteractionAt` timestamp,
	CONSTRAINT `channelProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `channelProfiles_channelId_unique` UNIQUE(`channelId`)
);
--> statement-breakpoint
CREATE TABLE `commentObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`youtubeCommentId` varchar(128) NOT NULL,
	`authorPublicId` varchar(255),
	`text` text NOT NULL,
	`likeCount` int NOT NULL DEFAULT 0,
	`publishedAt` timestamp,
	`classification` enum('noise','conversation','exposure','help_request','risk') NOT NULL DEFAULT 'noise',
	`riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
	`exposureSignals` text,
	`source` enum('youtube_api','apify','manual','demo') NOT NULL DEFAULT 'demo',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commentObservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `commentObservations_youtubeCommentId_unique` UNIQUE(`youtubeCommentId`)
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`parentCommentId` varchar(128),
	`type` enum('A_video','B_reply','C_link') NOT NULL,
	`text` text NOT NULL,
	`containsLink` int NOT NULL DEFAULT 0,
	`utmUrl` varchar(1000),
	`quoteVideo` text,
	`quoteComment` text,
	`riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
	`similarityScore` int NOT NULL DEFAULT 0,
	`justification` text,
	`model` varchar(120) NOT NULL DEFAULT 'ruleset-demo',
	`status` enum('drafted','review','edited','approved','discarded','publishing','published','blocked') NOT NULL DEFAULT 'review',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`draftId` int NOT NULL,
	`videoId` int NOT NULL,
	`youtubeCommentId` varchar(128),
	`parentCommentId` varchar(128),
	`publishedAt` timestamp,
	`verificationStatus` enum('pending','verified','failed') NOT NULL DEFAULT 'pending',
	`likeStatus` enum('not_applicable','pending_manual','confirmed') NOT NULL DEFAULT 'pending_manual',
	`replyCount` int NOT NULL DEFAULT 0,
	`removedStatus` int NOT NULL DEFAULT 0,
	`errorCode` varchar(120),
	`notes` text,
	CONSTRAINT `publications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rulesets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(40) NOT NULL,
	`documentSource` varchar(255) NOT NULL,
	`rulesJson` text NOT NULL,
	`active` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rulesets_id` PRIMARY KEY(`id`),
	CONSTRAINT `rulesets_version_unique` UNIQUE(`version`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`youtubeVideoId` varchar(32) NOT NULL,
	`url` varchar(500) NOT NULL,
	`title` text NOT NULL,
	`channelId` varchar(128) NOT NULL,
	`channelName` varchar(255) NOT NULL,
	`publishedAt` timestamp,
	`viewCount` int NOT NULL DEFAULT 0,
	`commentCount` int NOT NULL DEFAULT 0,
	`language` varchar(12) NOT NULL DEFAULT 'es',
	`niche` varchar(120),
	`description` text,
	`source` enum('youtube_api','apify','manual','demo') NOT NULL DEFAULT 'demo',
	`eligibilityStatus` enum('discovered','eligible','rejected','blocked') NOT NULL DEFAULT 'discovered',
	`relevanceScore` int NOT NULL DEFAULT 0,
	`riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `videos_youtubeVideoId_unique` UNIQUE(`youtubeVideoId`)
);
