CREATE TABLE `otp_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`paytag_id` text NOT NULL,
	`chain` text NOT NULL,
	`asset` text DEFAULT 'UNKNOWN' NOT NULL,
	`amount` text NOT NULL,
	`from_address` text,
	`to_address` text NOT NULL,
	`tx_hash` text NOT NULL,
	`circle_transfer_id` text,
	`raw_event` text NOT NULL,
	`status` text DEFAULT 'detected' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`paytag_id`) REFERENCES `paytags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_tx_hash_unique` ON `payments` (`tx_hash`);--> statement-breakpoint
CREATE TABLE `paytags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`handle` text NOT NULL,
	`display_name` text,
	`destination_address` text NOT NULL,
	`circle_wallet_id` text NOT NULL,
	`circle_wallet_address` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paytags_handle_unique` ON `paytags` (`handle`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`receipt_public_id` text NOT NULL,
	`paytag_handle` text NOT NULL,
	`amount_usdc` text NOT NULL,
	`tx_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_receipt_public_id_unique` ON `receipts` (`receipt_public_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);