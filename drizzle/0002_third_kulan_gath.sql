CREATE TABLE `ss_pantries` (
	`account_id` text PRIMARY KEY NOT NULL,
	`products` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`bot` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ss_telegram_codes` (
	`hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ss_telegram_links` (
	`telegram_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`link_id` text NOT NULL,
	`display_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ss_telegram_links_account_id_unique` ON `ss_telegram_links` (`account_id`);--> statement-breakpoint
CREATE TABLE `ss_telegram_runtime` (
	`id` text PRIMARY KEY NOT NULL,
	`heartbeat` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ss_telegram_updates` (
	`id` integer PRIMARY KEY NOT NULL,
	`response` text,
	`sent` integer DEFAULT 0 NOT NULL,
	`lease_until` integer NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL
);
