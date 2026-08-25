import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { getAppUrl } from "@/lib/app-url";
import { auth } from "@/lib/auth";
import { evaluateCoupon, recordCouponRedemption } from "@/lib/coupons";
import { db } from "@/lib/db";
import { events, orders, ticketTiers } from "@/lib/db/schema";
import { createCollection, isRwandaPayConfigured } from "@/lib/rwandapay";
import { getSoldCountsByTier } from "@/lib/ticketing";
import { issueTicketsForOrder, tierIsOnSale } from "@/lib/ticketing-server";

const orderSchema = z.object({
  couponCode: z.string().max(40).optional(),
  customerEmail: z.string().email().nullish(),
  customerName: z.string().min(1).max(120).optional(),
  customerPhone: z.string().regex(/^07\d{8}$/, "Phone must be 07XXXXXXXX"),
  quantity: z.number().int().min(1).max(100),
  tierId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid data" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const [event] = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(eq(events.id, eventId));
  if (!event) {
    return Response.json({ message: "Event not found" }, { status: 404 });
  }

  const [tier] = await db
    .select()
    .from(ticketTiers)
    .where(
      and(eq(ticketTiers.id, input.tierId), eq(ticketTiers.eventId, eventId))
    );
  if (!tier) {
    return Response.json({ message: "Ticket tier not found" }, { status: 404 });
  }

  const now = new Date();
  if (!tierIsOnSale(tier, now)) {
    return Response.json(
      { message: "This ticket is not on sale right now" },
      { status: 400 }
    );
  }
  if (input.quantity > tier.maxPerOrder) {
    return Response.json(
      { message: `Maximum ${tier.maxPerOrder} tickets per order` },
      { status: 400 }
    );
  }

  const soldMap = await getSoldCountsByTier(eventId);
  const sold = soldMap.get(tier.id) ?? 0;
  if (tier.quantity !== null && sold + input.quantity > tier.quantity) {
    const remaining = Math.max(tier.quantity - sold, 0);
    return Response.json(
      {
        message:
          remaining === 0
            ? "This ticket is sold out"
            : `Only ${remaining} left`,
      },
      { status: 409 }
    );
  }

  const subtotal = tier.price * input.quantity;
  let couponId: string | null = null;
  let discountAmount = 0;
  if (input.couponCode) {
    const evaluation = await evaluateCoupon(
      eventId,
      input.couponCode,
      subtotal
    );
    if (!evaluation.coupon) {
      return Response.json(
        { message: evaluation.error ?? "Invalid coupon code" },
        { status: 400 }
      );
    }
    couponId = evaluation.coupon.id;
    discountAmount = evaluation.discountAmount;
  }

  const totalAmount = Math.max(subtotal - discountAmount, 0);
  const customerName = input.customerName ?? session.user.name ?? "Customer";

  let orderId: string | null = null;
  try {
    const [order] = await db
      .insert(orders)
      .values({
        couponId,
        customerEmail: input.customerEmail ?? null,
        customerName,
        customerPhone: input.customerPhone,
        discountAmount,
        eventId,
        quantity: input.quantity,
        tierId: tier.id,
        totalAmount,
        unitPrice: tier.price,
        userId: session.user.id,
      })
      .returning({ id: orders.id });
    orderId = order.id;

    if (totalAmount === 0) {
      await db
        .update(orders)
        .set({ paidAt: now, status: "paid" })
        .where(eq(orders.id, orderId));
      try {
        await recordCouponRedemption(orderId);
      } catch (error) {
        console.error("[orders] coupon redemption failed:", error);
      }
      try {
        await issueTicketsForOrder(orderId);
      } catch (error) {
        console.error("[orders] ticket issuance failed:", error);
      }
      return Response.json({ orderId, status: "paid" }, { status: 201 });
    }

    if (!isRwandaPayConfigured) {
      throw new Error("Payments are not configured yet");
    }

    const appUrl = getAppUrl();
    const collection = await createCollection({
      amount: totalAmount,
      customer: {
        name: customerName,
        phone: input.customerPhone,
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
      },
      description: `${input.quantity}x ${tier.name} — ${event.title}`,
      metadata: { order_id: orderId },
      redirectUrl: `${appUrl}/orders/${orderId}`,
      reference: `ORD-${orderId}`,
      webhookUrl: `${appUrl}/api/webhooks/payments`,
    });

    await db
      .update(orders)
      .set({
        paymentReference: collection.reference,
        paymentUrl: collection.paymentUrl,
      })
      .where(eq(orders.id, orderId));

    return Response.json(
      { orderId, paymentUrl: collection.paymentUrl, status: "pending" },
      { status: 201 }
    );
  } catch (error) {
    if (orderId) {
      await db.delete(orders).where(eq(orders.id, orderId));
    }
    console.error("[orders] checkout failed:", error);
    return Response.json(
      { message: "Could not start payment. Please try again." },
      { status: 502 }
    );
  }
}
