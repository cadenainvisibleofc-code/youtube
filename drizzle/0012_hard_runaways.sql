CREATE TABLE `publicationEngagementEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicationId` int NOT NULL,
	`eventType` enum('reply','mention','like','removed','verified') NOT NULL,
	`externalEventId` varchar(180),
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`metadata` text,
	CONSTRAINT `publicationEngagementEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `publicationEngagementEvents_external_unique` UNIQUE(`eventType`,`externalEventId`)
);
--> statement-breakpoint
CREATE TABLE `publicationOutbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`draftId` int NOT NULL,
	`ownerOpenId` varchar(128) NOT NULL,
	`idempotencyKey` varchar(180) NOT NULL,
	`status` enum('pending','processing','succeeded','uncertain','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`nextAttemptAt` timestamp NOT NULL DEFAULT (now()),
	`lockedUntil` timestamp,
	`youtubeCommentId` varchar(128),
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `publicationOutbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `publicationOutbox_draftId_unique` UNIQUE(`draftId`),
	CONSTRAINT `publicationOutbox_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `automationSettings` MODIFY COLUMN `dailyLimit` int NOT NULL DEFAULT 30;--> statement-breakpoint
ALTER TABLE `publicationEngagementEvents` ADD CONSTRAINT `publicationEngagementEvents_publication_fk` FOREIGN KEY (`publicationId`) REFERENCES `publications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publicationOutbox` ADD CONSTRAINT `publicationOutbox_draft_fk` FOREIGN KEY (`draftId`) REFERENCES `drafts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `publicationEngagementEvents_publication_event_idx` ON `publicationEngagementEvents` (`publicationId`,`eventType`);--> statement-breakpoint
CREATE INDEX `publicationOutbox_status_next_attempt_idx` ON `publicationOutbox` (`status`,`nextAttemptAt`);