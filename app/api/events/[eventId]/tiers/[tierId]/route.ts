import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, ticketTiers } from "@/lib/db/schema";
import { getHostOrCohostEvent } from "@/lib/ticketing-server";

const tierUpdateSchema = z.object({
  description: z.string().max(500).nullish(),
  maxPerOrder: z.number().int().min(1).max(100).optional(),
  name: z.string().min(1).max(100).optional(),
  price: z.number().int().min(0).optional(),
  quantity: z.number().int().min(1).nullish(),
  salesEnd: z.string().datetime({ offset: true }).nullish(),
  salesStart: z.string().datetime({ offset: true }).nullish(),
});

async function getManagedTier(eventId: string, tierId: string, userId: string) {
  const event = await getHostOrCohostEvent(eventId, userId);
  if (!event) {
    return null;
  }
  const [tier] = await db
    .select()
    .from(ticketTiers)
    .where(and(eq(ticketTiers.id, tierId), eq(ticketTiers.eventId, eventId)));
  return tier ?? null;
}

function resolveDate(
  incoming: string | null | undefined,
  existing: Date | null
): Date | null {
  if (incoming === undefined) {
    return existing;
  }
  return incoming === null ? null : new Date(incoming);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; tierId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventId, tierId } = await params;
  const tier = await getManagedTier(eventId, tierId, session.user.id);
  if (!tier) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = tierUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Invalid data" }, { status: 400 });
  }

  const salesStart = resolveDate(parsed.data.salesStart, tier.salesStart);
  const salesEnd = resolveDate(parsed.data.salesEnd, tier.salesEnd);
  if (salesStart && salesEnd && salesStart >= salesEnd) {
    return Response.json(
      { message: "Sales start must be before sales end" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(ticketTiers)
    .set({
      ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
      ...(parsed.data.description === undefined
        ? {}
        : { description: parsed.data.description ?? null }),
      ...(parsed.data.price === undefined ? {} : { price: parsed.data.price }),
      ...(parsed.data.quantity === undefined
        ? {}
        : { quantity: parsed.data.quantity ?? null }),
      ...(parsed.data.maxPerOrder === undefined
        ? {}
        : { maxPerOrder: parsed.data.maxPerOrder }),
      salesEnd,
      salesStart,
      updatedAt: new Date(),
    })
    .where(eq(ticketTiers.id, tierId))
    .returning();

  return Response.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; tierId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventId, tierId } = await params;
  const tier = await getManagedTier(eventId, tierId, session.user.id);
  if (!tier) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const [paidOrder] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.tierId, tierId), eq(orders.status, "paid")))
    .limit(1);

  if (paidOrder) {
    return Response.json(
      { message: "Cannot delete a tier with paid orders" },
      { status: 409 }
    );
  }

  await db.delete(ticketTiers).where(eq(ticketTiers.id, tierId));
  return Response.json({ status: "deleted" });
}
