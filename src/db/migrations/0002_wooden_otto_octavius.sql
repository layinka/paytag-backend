CREATE TABLE `swap_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`next_run_at` integer NOT NULL,
	`locked_at` integer,
	`locked_by` text,
	`completed_at` integer,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `swap_jobs_payment_id_unique` ON `swap_jobs` (`payment_id`);--> statement-breakpoint
ALTER TABLE `payments` ADD `swap_status` text DEFAULT 'not_applicable' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `swap_tx_hash` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `swap_error` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `amount_out_usdc` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `router_used` text;--> statement-breakpoint
ALTER TABLE `receipts` ADD `swap_details_json` text;--> statement-breakpoint
ALTER TABLE `users` ADD `autoswap_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `autoswap_slippage_bps` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `autoswap_max_gas_gwei` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `autoswap_min_amount_wei` text;