import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { coupons, orders } from "@/lib/db/schema";

export type Coupon = typeof coupons.$inferSelect;

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Discount in RWF for a subtotal, clamped to [0, subtotal]. */
export function computeDiscount(coupon: Coupon, subtotal: number): number {
  if (subtotal <= 0) {
    return 0;
  }
  const raw =
    coupon.type === "percent"
      ? Math.floor((subtotal * coupon.value) / 100)
      : coupon.value;
  return Math.max(0, Math.min(raw, subtotal));
}

export interface CouponEvaluation {
  coupon?: Coupon;
  discountAmount: number;
  error?: string;
}

/**
 * Validates a coupon against an event and computes the discount for a
 * subtotal. Returns the failure reason so callers can surface it verbatim.
 */
export async function evaluateCoupon(
  eventId: string,
  code: string,
  subtotal: number
): Promise<CouponEvaluation> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) {
    return { discountAmount: 0, error: "Enter a coupon code" };
  }

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.eventId, eventId), eq(coupons.code, normalized)));

  if (!coupon) {
    return { discountAmount: 0, error: "Invalid coupon code" };
  }
  if (!coupon.active) {
    return { discountAmount: 0, error: "This coupon is no longer active" };
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { discountAmount: 0, error: "This coupon has expired" };
  }
  if (
    coupon.maxRedemptions !== null &&
    coupon.timesRedeemed >= coupon.maxRedemptions
  ) {
    return { discountAmount: 0, error: "This coupon has been fully redeemed" };
  }

  return { coupon, discountAmount: computeDiscount(coupon, subtotal) };
}

/**
 * Counts one redemption once an order transitions to paid. Called from every
 * fulfillment path (webhook, polling fallback, free checkout) so usage stats
 * stay accurate regardless of how payment confirmation arrives.
 */
export async function recordCouponRedemption(orderId: string): Promise<void> {
  const [order] = await db
    .select({ couponId: orders.couponId })
    .from(orders)
    .where(eq(orders.id, orderId));

  if (!order?.couponId) {
    return;
  }

  await db
    .update(coupons)
    .set({ timesRedeemed: sql`${coupons.timesRedeemed} + 1` })
    .where(eq(coupons.id, order.couponId));
}
