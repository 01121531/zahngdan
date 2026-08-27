CREATE TABLE `update_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`message` text NOT NULL,
	`current_version` text,
	`request_id` text,
	`requested_at` text,
	`started_at` text,
	`finished_at` text,
	`heartbeat_at` text
);
