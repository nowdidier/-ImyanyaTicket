import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ticketTiers } from "@/lib/db/schema";
import { listTiersWithSold } from "@/lib/ticketing";
import { getHostOrCohostEvent, parseSalesWindow } from "@/lib/ticketing-server";

const tierSchema = z.object({
  description: z.string().max(500).nullish(),
  maxPerOrder: z.number().int().min(1).max(100).default(10),
  name: z.string().min(1).max(100),
  price: z.number().int().min(0),
  quantity: z.number().int().min(1).nullish(),
  salesEnd: z.string().datetime({ offset: true }).nullish(),
  salesStart: z.string().datetime({ offset: true }).nullish(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const tiers = await listTiersWithSold(eventId);
  return Response.json(tiers);
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

  const body = await req.json();
  const parsed = tierSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Invalid data" }, { status: 400 });
  }
  const windowError = parseSalesWindow(
    parsed.data.salesStart,
    parsed.data.salesEnd
  );
  if (windowError) {
    return Response.json({ message: windowError }, { status: 400 });
  }

  const [tier] = await db
    .insert(ticketTiers)
    .values({
      description: parsed.data.description ?? null,
      eventId,
      maxPerOrder: parsed.data.maxPerOrder,
      name: parsed.data.name,
      price: parsed.data.price,
      quantity: parsed.data.quantity ?? null,
      salesEnd: parsed.data.salesEnd ? new Date(parsed.data.salesEnd) : null,
      salesStart: parsed.data.salesStart
        ? new Date(parsed.data.salesStart)
        : null,
    })
    .returning();

  return Response.json(tier, { status: 201 });
}
