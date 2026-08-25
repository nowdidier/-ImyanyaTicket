import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { evaluateCoupon } from "@/lib/coupons";
import { db } from "@/lib/db";
import { ticketTiers } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";

const validateSchema = z.object({
  code: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(100).default(1),
  tierId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  const limited = await checkRateLimit(
    req,
    `coupon-validate:${session?.user.id ?? "anon"}`
  );
  if (limited) {
    return limited;
  }

  const { eventId } = await params;
  const parsed = validateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ message: "Invalid data" }, { status: 400 });
  }
  const { code, quantity, tierId } = parsed.data;

  const [tier] = await db
    .select()
    .from(ticketTiers)
    .where(and(eq(ticketTiers.id, tierId), eq(ticketTiers.eventId, eventId)));
  if (!tier) {
    return Response.json({ message: "Ticket tier not found" }, { status: 404 });
  }

  const subtotal = tier.price * quantity;
  const evaluation = await evaluateCoupon(eventId, code, subtotal);
  if (!evaluation.coupon) {
    return Response.json(
      { valid: false, message: evaluation.error },
      { status: 200 }
    );
  }

  return Response.json({
    discountAmount: evaluation.discountAmount,
    subtotal,
    total: Math.max(subtotal - evaluation.discountAmount, 0),
    valid: true,
  });
}
