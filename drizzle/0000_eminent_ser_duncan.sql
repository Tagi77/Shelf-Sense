CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`expires_on` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`storage` text DEFAULT 'fridge' NOT NULL,
	`temperature` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE INDEX `products_user_state_idx` ON `products` (`user_id`,`state`);