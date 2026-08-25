import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  attendeeCheckins,
  events,
  orders,
  rsvps,
  rsvpTimeline,
  ticketTransfers,
  user,
} from "@/lib/db/schema";
import {
  sendRsvpConfirmationEmail,
  sendTicketTransferEmail,
} from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

const transferSchema = z.object({
  recipientEmail: z.string().email("Enter a valid email address"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const limited = await checkRateLimit(request, `transfer:${session.user.id}`);
  if (limited) {
    return limited;
  }

  const parsed = transferSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid data" },
      { status: 400 }
    );
  }
  const recipientEmail = parsed.data.recipientEmail.trim().toLowerCase();

  const [senderRsvp, event] = await Promise.all([
    db.query.rsvps.findFirst({
      where: and(eq(rsvps.eventId, eventId), eq(rsvps.userId, session.user.id)),
    }),
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
      where: eq(events.id, eventId),
    }),
  ]);

  if (!event) {
    return Response.json({ message: "Event not found" }, { status: 404 });
  }
  if (senderRsvp?.status !== "approved") {
    return Response.json(
      { message: "You don't have a ticket for this event" },
      { status: 400 }
    );
  }
  if (recipientEmail === session.user.email?.toLowerCase()) {
    return Response.json(
      { message: "You can't transfer a ticket to yourself" },
      { status: 400 }
    );
  }

  // Tickets are worthless once the event is over
  const eventEnd = event.endTime ?? event.startTime;
  if (eventEnd.getTime() < Date.now()) {
    return Response.json(
      { message: "This event has already ended" },
      { status: 400 }
    );
  }

  const [checkedIn] = await db
    .select({ id: attendeeCheckins.id })
    .from(attendeeCheckins)
    .where(
      and(
        eq(attendeeCheckins.eventId, eventId),
        eq(attendeeCheckins.userId, session.user.id)
      )
    );
  if (checkedIn) {
    return Response.json(
      { message: "You've already checked in — tickets can't be transferred" },
      { status: 400 }
    );
  }

  const [recipient] = await db
    .select({
      email: user.email,
      id: user.id,
      name: user.name,
    })
    .from(user)
    .where(sql`lower(${user.email}) = ${recipientEmail}`);
  if (!recipient) {
    return Response.json(
      {
        message:
          "No Imyanya account uses that email. Ask them to sign up first.",
      },
      { status: 404 }
    );
  }

  const [existingRecipientRsvp] = await db
    .select()
    .from(rsvps)
    .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, recipient.id)));

  try {
    await db.transaction(async (tx) => {
      if (existingRecipientRsvp) {
        await tx
          .update(rsvps)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(rsvps.id, existingRecipientRsvp.id));
        await tx.insert(rsvpTimeline).values({
          eventId,
          fromStatus: existingRecipientRsvp.status,
          rsvpId: existingRecipientRsvp.id,
          toStatus: "approved",
          type: "transferred_in",
        });
      } else {
        const [created] = await tx
          .insert(rsvps)
          .values({
            eventId,
            status: "approved",
            userId: recipient.id,
          })
          .returning();
        await tx.insert(rsvpTimeline).values({
          eventId,
          rsvpId: created.id,
          toStatus: "approved",
          type: "transferred_in",
        });
      }

      // The whole booking moves: paid + pending orders follow the ticket.
      const movedOrders = await tx
        .update(orders)
        .set({ userId: recipient.id })
        .where(
          and(eq(orders.eventId, eventId), eq(orders.userId, session.user.id))
        )
        .returning({ id: orders.id });

      await tx.insert(ticketTransfers).values({
        eventId,
        fromUserId: session.user.id,
        orderIds: movedOrders.map((o) => o.id),
        toUserId: recipient.id,
      });

      // Sender loses their RSVP last — the QR they hold embeds their userId,
      // so deleting this row is what invalidates it at check-in.
      await tx.delete(rsvps).where(eq(rsvps.id, senderRsvp.id));
    });
  } catch (error) {
    console.error("[transfer] failed:", error);
    return Response.json(
      { message: "Transfer failed. Please try again." },
      { status: 500 }
    );
  }

  // Recipient gets the full confirmation email with their new ticket link;
  // the sender is told the transfer went through.
  await Promise.allSettled([
    sendRsvpConfirmationEmail(recipient.email, event.title, "approved", {
      endTime: event.endTime,
      id: event.id,
      location: event.location,
      slug: event.slug ?? undefined,
      startTime: event.startTime,
      timezone: event.timezone,
      title: event.title,
    }),
    session.user.email
      ? sendTicketTransferEmail(
          session.user.email,
          event.title,
          recipient.name,
          { id: event.id, slug: event.slug ?? undefined }
        )
      : Promise.resolve(),
  ]);

  return Response.json({ message: "Ticket transferred" }, { status: 200 });
}
