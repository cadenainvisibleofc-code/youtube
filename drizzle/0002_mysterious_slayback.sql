CREATE TABLE `youtubeConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(128) NOT NULL,
	`channelId` varchar(128) NOT NULL,
	`channelName` varchar(255) NOT NULL,
	`accessTokenEncrypted` text NOT NULL,
	`refreshTokenEncrypted` text NOT NULL,
	`tokenExpiresAt` timestamp,
	`scopes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `youtubeConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `youtubeConnections_ownerOpenId_unique` UNIQUE(`ownerOpenId`)
);
