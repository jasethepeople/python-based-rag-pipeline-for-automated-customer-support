CREATE TABLE `feedbackEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`rating` enum('up','down') NOT NULL,
	`comment` text NOT NULL,
	`issueCategory` enum('none','inaccurate','missing_detail','unclear','outdated','other') NOT NULL DEFAULT 'none',
	`reviewStatus` enum('new','investigating','resolved') NOT NULL DEFAULT 'new',
	`reviewerNote` text NOT NULL,
	`pinned` boolean NOT NULL DEFAULT false,
	`submittedByUserId` int,
	`reviewedByUserId` int,
	`alertedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feedbackEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `feedbackEntries_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `feedback_created_idx` ON `feedbackEntries` (`createdAt`);--> statement-breakpoint
CREATE INDEX `feedback_rating_status_idx` ON `feedbackEntries` (`rating`,`reviewStatus`);--> statement-breakpoint
CREATE INDEX `feedback_submitter_idx` ON `feedbackEntries` (`submittedByUserId`);