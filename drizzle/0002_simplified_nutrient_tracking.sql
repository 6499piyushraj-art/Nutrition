ALTER TABLE `foods` ADD `nutrient_values` text;
--> statement-breakpoint
ALTER TABLE `foods` ADD `nutrient_source` text;
--> statement-breakpoint
ALTER TABLE `food_entries` ADD `nutrient_values` text;
--> statement-breakpoint
ALTER TABLE `food_entries` ADD `nutrient_source` text;
--> statement-breakpoint
CREATE TABLE `nutrient_targets` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL UNIQUE,
  `targets` text NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
