ALTER TABLE `youtubeConnections` DROP INDEX `youtubeConnections_ownerOpenId_unique`;--> statement-breakpoint
ALTER TABLE `drafts` ADD `projectChannelId` int;--> statement-breakpoint
ALTER TABLE `publicationOutbox` ADD `projectChannelId` int;--> statement-breakpoint
ALTER TABLE `publications` ADD `projectChannelId` int;--> statement-breakpoint
ALTER TABLE `youtubeConnections` ADD `projectChannelId` int;--> statement-breakpoint
ALTER TABLE `youtubeConnections` ADD CONSTRAINT `youtubeConnections_project_channel_unique` UNIQUE(`projectChannelId`);--> statement-breakpoint
ALTER TABLE `drafts` ADD CONSTRAINT `drafts_project_channel_fk` FOREIGN KEY (`projectChannelId`) REFERENCES `projectChannels`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publicationOutbox` ADD CONSTRAINT `publicationOutbox_project_channel_fk` FOREIGN KEY (`projectChannelId`) REFERENCES `projectChannels`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publications` ADD CONSTRAINT `publications_project_channel_fk` FOREIGN KEY (`projectChannelId`) REFERENCES `projectChannels`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `youtubeConnections` ADD CONSTRAINT `youtubeConnections_project_channel_fk` FOREIGN KEY (`projectChannelId`) REFERENCES `projectChannels`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `drafts_project_channel_idx` ON `drafts` (`projectChannelId`);--> statement-breakpoint
CREATE INDEX `publicationOutbox_project_channel_idx` ON `publicationOutbox` (`projectChannelId`);--> statement-breakpoint
CREATE INDEX `publications_project_channel_idx` ON `publications` (`projectChannelId`);--> statement-breakpoint
CREATE INDEX `youtubeConnections_owner_idx` ON `youtubeConnections` (`ownerOpenId`);--> statement-breakpoint
CREATE INDEX `youtubeConnections_project_channel_idx` ON `youtubeConnections` (`projectChannelId`);