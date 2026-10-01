ALTER TABLE `automationSettings` DROP INDEX `automationSettings_ownerOpenId_unique`;--> statement-breakpoint
ALTER TABLE `automationSettings` ADD `projectChannelId` int;--> statement-breakpoint
ALTER TABLE `automationSettings` ADD CONSTRAINT `automationSettings_project_channel_unique` UNIQUE(`projectChannelId`);--> statement-breakpoint
ALTER TABLE `automationSettings` ADD CONSTRAINT `automationSettings_project_channel_fk` FOREIGN KEY (`projectChannelId`) REFERENCES `projectChannels`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `automationSettings_owner_idx` ON `automationSettings` (`ownerOpenId`);