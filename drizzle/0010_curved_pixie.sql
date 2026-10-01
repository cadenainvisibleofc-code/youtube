CREATE TABLE `editorialFeedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`draftId` int NOT NULL,
	`ownerId` int,
	`outcome` enum('approved','edited','discarded','blocked') NOT NULL,
	`originalText` text NOT NULL,
	`finalText` text,
	`changeSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `editorialFeedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `readingVisits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitToken` varchar(80) NOT NULL,
	`source` varchar(80) NOT NULL DEFAULT 'direct',
	`campaign` varchar(120) NOT NULL DEFAULT 'none',
	`videoReference` varchar(200) NOT NULL DEFAULT 'unknown',
	`secondsRead` int NOT NULL DEFAULT 0,
	`completed` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `readingVisits_id` PRIMARY KEY(`id`),
	CONSTRAINT `readingVisits_visitToken_unique` UNIQUE(`visitToken`)
);
--> statement-breakpoint
CREATE TABLE `videoMetricSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`viewCount` int NOT NULL DEFAULT 0,
	`commentCount` int NOT NULL DEFAULT 0,
	`likeCount` int NOT NULL DEFAULT 0,
	`opportunityScore` int NOT NULL DEFAULT 0,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `videoMetricSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `editorialFeedback` ADD CONSTRAINT `editorialFeedback_draft_fk` FOREIGN KEY (`draftId`) REFERENCES `drafts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `editorialFeedback` ADD CONSTRAINT `editorialFeedback_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videoMetricSnapshots` ADD CONSTRAINT `videoMetricSnapshots_video_fk` FOREIGN KEY (`videoId`) REFERENCES `videos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `editorialFeedback_draft_created_idx` ON `editorialFeedback` (`draftId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `readingVisits_source_created_idx` ON `readingVisits` (`source`,`createdAt`);--> statement-breakpoint
CREATE INDEX `videoMetricSnapshots_video_captured_idx` ON `videoMetricSnapshots` (`videoId`,`capturedAt`);