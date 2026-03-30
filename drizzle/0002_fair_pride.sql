ALTER TABLE `targets` ADD `interaction_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `targets` ADD `last_seen` text;--> statement-breakpoint
ALTER TABLE `targets` ADD `source` text DEFAULT 'manual';