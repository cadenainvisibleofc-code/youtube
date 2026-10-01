ALTER TABLE `editorialFeedback` DROP FOREIGN KEY `editorialFeedback_draft_fk`;
--> statement-breakpoint
ALTER TABLE `editorialMemoryEvents` DROP FOREIGN KEY `editorialMemoryEvents_memory_fk`;
--> statement-breakpoint
ALTER TABLE `publicationEngagementEvents` DROP FOREIGN KEY `publicationEngagementEvents_publication_fk`;
--> statement-breakpoint
ALTER TABLE `editorialFeedback` ADD CONSTRAINT `editorialFeedback_draft_fk` FOREIGN KEY (`draftId`) REFERENCES `drafts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `editorialMemoryEvents` ADD CONSTRAINT `editorialMemoryEvents_memory_fk` FOREIGN KEY (`memoryId`) REFERENCES `editorialMemories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publicationEngagementEvents` ADD CONSTRAINT `publicationEngagementEvents_publication_fk` FOREIGN KEY (`publicationId`) REFERENCES `publications`(`id`) ON DELETE restrict ON UPDATE no action;