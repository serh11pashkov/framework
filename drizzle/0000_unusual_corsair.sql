CREATE TABLE `items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`device` varchar(255) NOT NULL,
	`status` varchar(10) NOT NULL,
	`room` varchar(255) NOT NULL,
	`description` text,
	`image` varchar(255),
	`power` varchar(255),
	CONSTRAINT `items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `migrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hash` varchar(32) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `migrations_id` PRIMARY KEY(`id`)
);
