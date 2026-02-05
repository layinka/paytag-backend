ALTER TABLE `receipts` ADD `paytag_name` text DEFAULT ''  NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `receiver_address` text DEFAULT ''   NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `chain` text DEFAULT 'BASE_SEPOLIA' NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `asset_in` text DEFAULT 'USDC' NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `amount_in` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `block_timestamp` text;--> statement-breakpoint
ALTER TABLE `receipts` ADD `status` text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `circle_transfer_id` text;--> statement-breakpoint
ALTER TABLE `receipts` ADD `explorer_url` text;--> statement-breakpoint
ALTER TABLE `receipts` ADD `walrus_blob_id` text;--> statement-breakpoint
ALTER TABLE `receipts` ADD `receipt_hash` text;