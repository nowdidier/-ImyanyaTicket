CREATE TYPE "public"."coupon_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TABLE "coupons" (
	"active" boolean DEFAULT true NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"event_id" text NOT NULL,
	"expires_at" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"max_redemptions" integer,
	"times_redeemed" integer DEFAULT 0 NOT NULL,
	"type" "coupon_type" DEFAULT 'percent' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_transfers" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"event_id" text NOT NULL,
	"from_user_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"order_ids" json DEFAULT '[]'::json NOT NULL,
	"to_user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_transfers" ADD CONSTRAINT "ticket_transfers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_transfers" ADD CONSTRAINT "ticket_transfers_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_transfers" ADD CONSTRAINT "ticket_transfers_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_event_code_unique" ON "coupons" USING btree ("event_id","code");--> statement-breakpoint
CREATE INDEX "coupons_event_id_idx" ON "coupons" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_transfers_event_id_idx" ON "ticket_transfers" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_transfers_from_user_idx" ON "ticket_transfers" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "ticket_transfers_to_user_idx" ON "ticket_transfers" USING btree ("to_user_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;