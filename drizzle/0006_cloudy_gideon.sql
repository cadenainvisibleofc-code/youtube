ALTER TABLE `automationSettings` ADD `lastError` text;--> statement-breakpoint
ALTER TABLE `automationSettings` ADD `pausedReason` varchar(120);--> statement-breakpoint
ALTER TABLE `youtubeConnections` ADD `status` enum('connected','reauthorization_required') DEFAULT 'connected' NOT NULL;--> statement-breakpoint
ALTER TABLE `youtubeConnections` ADD `lastError` text;