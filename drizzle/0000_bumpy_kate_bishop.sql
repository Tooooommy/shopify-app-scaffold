CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop" text NOT NULL,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"mimeType" text NOT NULL,
	"size" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	CONSTRAINT "files_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"state" text NOT NULL,
	"isOnline" boolean DEFAULT false NOT NULL,
	"scope" text,
	"expires" timestamp,
	"accessToken" text NOT NULL,
	"userId" bigint,
	"firstName" text,
	"lastName" text,
	"email" text,
	"accountOwner" boolean,
	"locale" text,
	"collaborator" boolean,
	"emailVerified" boolean,
	"refreshToken" text,
	"refreshTokenExpires" timestamp
);
