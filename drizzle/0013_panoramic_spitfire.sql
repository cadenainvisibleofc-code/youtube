CREATE TABLE `projectChannels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`channelId` varchar(128) NOT NULL,
	`channelName` varchar(255) NOT NULL,
	`status` enum('pending','connected','reauthorization_required','paused','revoked') NOT NULL DEFAULT 'pending',
	`minInteractionIntervalDays` int NOT NULL DEFAULT 30,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectChannels_id` PRIMARY KEY(`id`),
	CONSTRAINT `projectChannels_project_channel_unique` UNIQUE(`projectId`,`channelId`)
);
--> statement-breakpoint
CREATE TABLE `projectMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`openId` varchar(128) NOT NULL,
	`role` enum('owner','editor','viewer') NOT NULL DEFAULT 'owner',
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `projectMembers_project_openId_unique` UNIQUE(`projectId`,`openId`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(180) NOT NULL,
	`status` enum('active','paused','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `projectChannels` ADD CONSTRAINT `projectChannels_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectMembers` ADD CONSTRAINT `projectMembers_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `projectChannels_project_status_idx` ON `projectChannels` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `projectMembers_project_status_idx` ON `projectMembers` (`projectId`,`status`);