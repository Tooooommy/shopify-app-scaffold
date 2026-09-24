CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"shop" text NOT NULL,
	"processedAt" timestamp DEFAULT now() NOT NULL
);
