CREATE TABLE `chatAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`ownerOpenId` varchar(128) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`kind` enum('image','pdf','audio') NOT NULL,
	`sizeBytes` int NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`storageUrl` varchar(800) NOT NULL,
	`transcript` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatConversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(128) NOT NULL,
	`title` varchar(180) NOT NULL DEFAULT 'Nova conversa',
	`archived` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatConversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chatMessages` ADD `conversationId` int;--> statement-breakpoint
ALTER TABLE `chatAttachments` ADD CONSTRAINT `chatAttachments_message_fk` FOREIGN KEY (`messageId`) REFERENCES `chatMessages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `chatAttachments_message_idx` ON `chatAttachments` (`messageId`);--> statement-breakpoint
CREATE INDEX `chatConversations_owner_updated_idx` ON `chatConversations` (`ownerOpenId`,`updatedAt`);--> statement-breakpoint
ALTER TABLE `chatMessages` ADD CONSTRAINT `chatMessages_conversation_fk` FOREIGN KEY (`conversationId`) REFERENCES `chatConversations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `chatMessages_conversation_created_idx` ON `chatMessages` (`conversationId`,`createdAt`);