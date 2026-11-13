CREATE TABLE `ss_notification_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`notification_id` text NOT NULL,
	`read_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notification_reads_owner_idx` ON `ss_notification_reads` (`account_id`);