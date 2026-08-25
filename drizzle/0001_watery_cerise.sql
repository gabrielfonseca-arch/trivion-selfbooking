ALTER TABLE "meetings" ADD COLUMN "risk_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "risk_level" "risk_level" DEFAULT 'baixo' NOT NULL;