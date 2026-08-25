import { and, asc, eq, sql } from "drizzle-orm";
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

/**
 * Promotes the oldest waitlisted RSVPs into any free seats, oldest first.
 * Call after an approved attendee leaves (cancel, host removal, downgrade)
 * or whenever capacity frees up. No-op when the event has no capacity set,
 * no open seats, or nobody is waitlisted. Emails are fire-and-forget so a
 * Resend hiccup can never fail the triggering request.
 */
export async function promoteNextFromWaitlist(eventId: string): Promise<void> {
  const event = await db.query.events.findFirst({
    columns: {
      capacity: true,
      endTime: true,
      id: true,
      location: true,
      slug: true,
      startTime: true,
      timezone: true,
      title: true,
    },
    where: eq(events.id, eventId),
  });
  if (!event?.capacity) {
    return;
  }

  for (;;) {
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rsvps)
      .where(and(eq(rsvps.eventId, eventId), eq(rsvps.status, "approved")));

    if (Number(count) >= event.capacity) {
      return;
    }

    const nextInLine = await db.query.rsvps.findFirst({
      orderBy: [asc(rsvps.createdAt)],
      where: and(eq(rsvps.eventId, eventId), eq(rsvps.status, "waitlisted")),
      with: { user: { columns: { email: true } } },
    });
    if (!nextInLine) {
      return;
    }

    await db
      .update(rsvps)
      .set({ status: "approved", updatedAt: new Date() })
      .where(and(eq(rsvps.id, nextInLine.id), eq(rsvps.status, "waitlisted")));

    db.insert(rsvpTimeline)
      .values({
        eventId,
        fromStatus: "waitlisted",
        rsvpId: nextInLine.id,
        toStatus: "approved",
        type: "waitlist_promoted",
      })
      .catch(() => {});

    if (nextInLine.user.email) {
      sendRsvpConfirmationEmail(
        nextInLine.user.email,
        event.title,
        "approved",
        {
          endTime: event.endTime,
          id: event.id,
          location: event.location,
          slug: event.slug ?? undefined,
          startTime: event.startTime,
          timezone: event.timezone,
          title: event.title,
        }
      ).catch((err) =>
        console.error("[waitlist] promotion email failed:", err)
      );
    }
  }
}
