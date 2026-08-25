import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { normalizeCouponCode } from "@/lib/coupons";
import { db } from "@/lib/db";
import { coupons } from "@/lib/db/schema";
import { getHostOrCohostEvent } from "@/lib/ticketing-server";

const couponSchema = z.object({
  code: z.string().min(1).max(40),
  expiresAt: z.string().datetime({ offset: true }).nullish(),
  maxRedemptions: z.number().int().min(1).nullish(),
  type: z.enum(["percent", "fixed"]),
  value: z.number().int().min(1),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const event = await getHostOrCohostEvent(eventId, session.user.id);
  if (!event) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const rows = await db.query.coupons.findMany({
    orderBy: [asc(coupons.createdAt)],
    where: eq(coupons.eventId, eventId),
  });

  return Response.json(rows);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const event = await getHostOrCohostEvent(eventId, session.user.id);
  if (!event) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const parsed = couponSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid data" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (input.type === "percent" && input.value > 100) {
    return Response.json(
      { message: "Percentage discount cannot exceed 100" },
      { status: 400 }
    );
  }

  try {
    const [coupon] = await db
      .insert(coupons)
      .values({
        code: normalizeCouponCode(input.code),
        eventId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        maxRedemptions: input.maxRedemptions ?? null,
        type: input.type,
        value: input.value,
      })
      .returning();

    return Response.json(coupon, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("coupons_event_code_unique")
    ) {
      return Response.json(
        { message: "A coupon with this code already exists" },
        { status: 409 }
      );
    }
    console.error("[coupons] create failed:", error);
    return Response.json(
      { message: "Could not create coupon" },
      { status: 500 }
    );
  }
}
