import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, orders, rsvps, rsvpTimeline, user } from "@/lib/db/schema";
import { sendRsvpConfirmationEmail } from "@/lib/email";

export async function getHostOrCohostEvent(eventId: string, userId: string) {
  const event = await db.query.events.findFirst({
    columns: { hostId: true },
    where: eq(events.id, eventId),
    with: { cohosts: { columns: { userId: true } } },
  });
  if (!event) {
    return null;
  }
  const isHost = event.hostId === userId;
  const isCohost = event.cohosts.some((c) => c.userId === userId);
  return isHost || isCohost ? event : null;
}

export function parseSalesWindow(
  salesStart?: string | null,
  salesEnd?: string | null
): string | null {
  if (salesStart && salesEnd && new Date(salesStart) >= new Date(salesEnd)) {
    return "Sales start must be before sales end";
  }
  return null;
}

export function tierIsOnSale(
  tier: { salesStart: Date | null; salesEnd: Date | null },
  now: Date
): boolean {
  if (tier.salesStart && now < tier.salesStart) {
    return false;
  }
  if (tier.salesEnd && now > tier.salesEnd) {
    return false;
  }
  return true;
}

export async function issueTicketsForOrder(orderId: string): Promise<void> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!(order && order.status === "paid")) {
    return;
  }

  const existing = await db.query.rsvps.findFirst({
    where: and(
      eq(rsvps.eventId, order.eventId),
      eq(rsvps.userId, order.userId)
    ),
  });

  if (existing?.status === "approved") {
    return;
  }

  let rsvpId: string;
  if (existing) {
    await db
      .update(rsvps)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(rsvps.id, existing.id));
    rsvpId = existing.id;
  } else {
    const [created] = await db
      .insert(rsvps)
      .values({
        eventId: order.eventId,
        status: "approved",
        userId: order.userId,
      })
      .returning();
    if (!created) {
      return;
    }
    rsvpId = created.id;
  }

  db.insert(rsvpTimeline)
    .values({
      eventId: order.eventId,
      rsvpId,
      toStatus: "approved",
      type: "ticket_issued",
    })
    .catch(() => {});

  const [buyer, event] = await Promise.all([
    db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, order.userId))
      .limit(1),
    db.query.events.findFirst({
      columns: {
        endTime: true,
        id: true,
        location: true,
        slug: true,
        startTime: true,
        timezone: true,
        title: true,
      },
      where: eq(events.id, order.eventId),
    }),
  ]);

  if (!(buyer[0]?.email && event)) {
    return;
  }

  await sendRsvpConfirmationEmail(buyer[0].email, event.title, "approved", {
    endTime: event.endTime,
    id: event.id,
    location: event.location,
    slug: event.slug ?? undefined,
    startTime: event.startTime,
    timezone: event.timezone,
    title: event.title,
  }).catch((err) => console.error("[tickets] confirmation email failed:", err));
}
