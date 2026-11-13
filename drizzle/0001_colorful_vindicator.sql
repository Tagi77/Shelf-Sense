CREATE TABLE `ss_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`site_user` text NOT NULL,
	`email` text NOT NULL,
	`nickname` text NOT NULL,
	`salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accounts_owner_idx` ON `ss_accounts` (`site_user`);--> statement-breakpoint
CREATE TABLE `ss_auth_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` text NOT NULL,
	`until` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ss_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`site_user` text NOT NULL,
	`expires_at` text NOT NULL
);
