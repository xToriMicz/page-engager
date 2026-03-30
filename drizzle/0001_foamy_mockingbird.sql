CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_id` integer,
	`posts` text DEFAULT '[]' NOT NULL,
	`scanned_at` text NOT NULL,
	FOREIGN KEY (`target_id`) REFERENCES `targets`(`id`) ON UPDATE no action ON DELETE no action
);
