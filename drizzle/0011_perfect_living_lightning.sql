CREATE TABLE `editorialMemories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(128) NOT NULL,
	`category` varchar(80) NOT NULL,
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`status` enum('core','proposed','approved','rejected','archived') NOT NULL DEFAULT 'proposed',
	`locked` int NOT NULL DEFAULT 0,
	`confidence` int NOT NULL DEFAULT 50,
	`source` varchar(120) NOT NULL DEFAULT 'human_feedback',
	`createdBy` int,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `editorialMemories_id` PRIMARY KEY(`id`),
	CONSTRAINT `editorialMemories_owner_title_unique` UNIQUE(`ownerOpenId`,`title`)
);
--> statement-breakpoint
CREATE TABLE `editorialMemoryEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memoryId` int NOT NULL,
	`ownerOpenId` varchar(128) NOT NULL,
	`action` varchar(40) NOT NULL,
	`actorOpenId` varchar(128) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `editorialMemoryEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `editorialMemories` ADD CONSTRAINT `editorialMemories_creator_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `editorialMemories` ADD CONSTRAINT `editorialMemories_reviewer_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `editorialMemoryEvents` ADD CONSTRAINT `editorialMemoryEvents_memory_fk` FOREIGN KEY (`memoryId`) REFERENCES `editorialMemories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `editorialMemories_owner_status_idx` ON `editorialMemories` (`ownerOpenId`,`status`);--> statement-breakpoint
CREATE INDEX `editorialMemoryEvents_memory_created_idx` ON `editorialMemoryEvents` (`memoryId`,`createdAt`);