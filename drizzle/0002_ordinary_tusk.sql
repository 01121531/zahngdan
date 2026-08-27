CREATE TABLE `transaction_requests` (
	`request_id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_transaction_requests_transaction` ON `transaction_requests` (`transaction_id`);