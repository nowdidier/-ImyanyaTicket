import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import {
  getCollection,
  getCollectionStatus,
  isRwandaPayConfigured,
} from "@/lib/rwandapay";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  let [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order || order.userId !== session.user.id) {
    return Response.json({ message: "Not found" }, { status: 404 });
  }

  // Polling fallback: webhooks can be delayed or missed while the customer
  // watches this page, so ask RwandaPay directly before reporting pending.
  if (
    order.status === "pending" &&
    order.paymentReference &&
    isRwandaPayConfigured
  ) {
    try {
      const [status, collection] = await Promise.all([
        getCollectionStatus(order.paymentReference),
        getCollection(order.paymentReference),
      ]);
      if (status.isPaid) {
        const [updated] = await db
          .update(orders)
          .set({
            paidAt: collection.paidAt
              ? new Date(collection.paidAt)
              : new Date(),
            paymentFee: collection.fee,
            paymentMethod: status.paymentMethod,
            status: "paid",
          })
          .where(eq(orders.id, orderId))
          .returning();
        order = updated ?? order;
      }
    } catch (error) {
      console.error("[orders] status poll failed:", error);
    }
  }

  return Response.json({
    id: order.id,
    paidAt: order.paidAt?.toISOString() ?? null,
    paymentReference: order.paymentReference,
    quantity: order.quantity,
    status: order.status,
    totalAmount: order.totalAmount,
    unitPrice: order.unitPrice,
  });
}
