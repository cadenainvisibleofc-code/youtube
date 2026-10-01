ALTER TABLE `automationSettings` ADD `runLeaseUntil` timestamp;--> statement-breakpoint
ALTER TABLE `drafts` ADD `dedupeKey` varchar(512);--> statement-breakpoint
ALTER TABLE `drafts` ADD CONSTRAINT `drafts_dedupeKey_unique` UNIQUE(`dedupeKey`);