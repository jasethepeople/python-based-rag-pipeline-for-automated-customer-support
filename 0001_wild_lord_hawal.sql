ALTER TABLE `feedbackEntries` ADD `sentiment` enum('positive','neutral','negative') DEFAULT 'neutral' NOT NULL;--> statement-breakpoint
ALTER TABLE `feedbackEntries` ADD `sentiment` enum('positive','neutral','negative') DEFAULT 'neutral' NOT NULL;
ALTER TABLE `feedbackEntries` ADD `sentimentSource` enum('ai','fallback') DEFAULT 'fallback' NOT NULL;
