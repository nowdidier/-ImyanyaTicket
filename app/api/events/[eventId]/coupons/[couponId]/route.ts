import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { normalizeCouponCode } from "@/lib/coupons";
import { db } from "@/lib/db";
import { coupons } from "@/lib/db/schema";
import { getHostOrCohostEvent } from "@/lib/ticketing-server";

const updateSchema = z.object({
  active: z.boolean().optional(),
  code: z.string().min(1).max(40).optional(),
  expiresAt: z.string().datetime({ offset: true }).nullish(),
  maxRedemptions: z.number().int().min(1).nullish(),
  type: z.enum(["percent", "fixed"]).optional(),
  value: z.number().int().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; couponId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventId, couponId } = await params;
  const event = await getHostOrCohostEvent(eventId, session.user.id);
  if (!event) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid data" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (input.type === "percent" && input.value && input.value > 100) {
    return Response.json(
      { message: "Percentage discount cannot exceed 100" },
      { status: 400 }
    );
  }

  const [coupon] = await db
    .update(coupons)
    .set({
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.code !== undefined
        ? { code: normalizeCouponCode(input.code) }
        : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
        : {}),
      ...(input.maxRedemptions !== undefined
        ? { maxRedemptions: input.maxRedemptions ?? null }
        : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(coupons.id, couponId), eq(coupons.eventId, eventId)))
    .returning();

  if (!coupon) {
    return Response.json({ message: "Coupon not found" }, { status: 404 });
  }

  return Response.json(coupon);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; couponId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventId, couponId } = await params;
  const event = await getHostOrCohostEvent(eventId, session.user.id);
  if (!event) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const [deleted] = await db
    .delete(coupons)
    .where(and(eq(coupons.id, couponId), eq(coupons.eventId, eventId)))
    .returning({ id: coupons.id });

  if (!deleted) {
    return Response.json({ message: "Coupon not found" }, { status: 404 });
  }

  return Response.json({ message: "Coupon deleted" });
}
