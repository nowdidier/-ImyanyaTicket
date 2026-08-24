import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import {
  getCollection,
  parseRwandaPayWebhook,
  type RwandaPayWebhookEvent,
  verifyRwandaPayWebhookSignature,
} from "@/lib/rwandapay";
import { issueTicketsForOrder } from "@/lib/ticketing-server";

// RwandaPay registers https://tickets.imyanya.rw/api/webhooks/payments and
// /api/payments/rwandapay/webhook also points here, so fulfillment logic
// lives in one place.
export async function handleRwandaPayWebhook(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";

  if (!verifyRwandaPayWebhookSignature(rawBody, signature)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: RwandaPayWebhookEvent;
  try {
    event = parseRwandaPayWebhook(rawBody);
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.status === "successful" && event.reference) {
    await fulfillOrder(event.reference, event);
  }

  // Always ack so RwandaPay stops retrying; unmatched events are logged for
  // reconciliation instead of requeued forever.
  console.log(
    `[rwandapay] event=${event.eventKind} status=${event.status} ref=${event.reference}`
  );

  return Response.json({ status: "success" });
}

async function fulfillOrder(reference: string, event: RwandaPayWebhookEvent) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.paymentReference, reference));

  if (!order) {
    console.warn(`[rwandapay] no order for collection ${reference}`);
    return;
  }
  if (order.status !== "pending") {
    return;
  }

  let fee: number | null = null;
  let paidAt = new Date();
  try {
    const { fee: gatewayFee, paidAt: providerPaidAt } =
      await getCollection(reference);
    if (gatewayFee !== null && Number.isFinite(gatewayFee)) {
      fee = Math.round(gatewayFee);
    }
    if (providerPaidAt) {
      paidAt = new Date(providerPaidAt);
    }
  } catch (error) {
    console.error("[rwandapay] enrich failed:", error);
  }

  await db
    .update(orders)
    .set({
      paidAt,
      paymentFee: fee,
      paymentMethod: event.network ?? order.paymentMethod,
      status: "paid",
    })
    .where(eq(orders.id, order.id));

  try {
    await issueTicketsForOrder(order.id);
  } catch (error) {
    console.error("[rwandapay] ticket issuance failed:", error);
  }
}
