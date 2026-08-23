CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TABLE "orders" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"customer_email" text,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"event_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"paid_at" timestamp,
	"payment_fee" integer,
	"payment_method" text,
	"payment_reference" text,
	"payment_url" text,
	"quantity" integer NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"tier_id" text NOT NULL,
	"total_amount" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_tiers" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"event_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"max_per_order" integer DEFAULT 10 NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"quantity" integer,
	"sales_end" timestamp,
	"sales_start" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tier_id_ticket_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."ticket_tiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tiers" ADD CONSTRAINT "ticket_tiers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_event_id_idx" ON "orders" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_payment_reference_unique" ON "orders" USING btree ("payment_reference");--> statement-breakpoint
CREATE INDEX "ticket_tiers_event_id_idx" ON "ticket_tiers" USING btree ("event_id");