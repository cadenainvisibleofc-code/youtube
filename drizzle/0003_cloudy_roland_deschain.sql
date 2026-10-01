CREATE TABLE `automationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(128) NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`autoPublish` int NOT NULL DEFAULT 0,
	`dailyLimit` int NOT NULL DEFAULT 3,
	`minChannelIntervalDays` int NOT NULL DEFAULT 30,
	`includeLink` int NOT NULL DEFAULT 1,
	`searchQueries` text,
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automationSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `automationSettings_ownerOpenId_unique` UNIQUE(`ownerOpenId`)
);
--> statement-breakpoint
CREATE INDEX `automationSettings_scheduleCronTaskUid_idx` ON `automationSettings` (`scheduleCronTaskUid`);