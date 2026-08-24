import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { getAppUrl } from "@/lib/app-url";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, orders, rsvps } from "@/lib/db/schema";

const appUrl = getAppUrl();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [rsvp, event, paidOrders] = await Promise.all([
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
    db.query.orders.findMany({
      columns: {
        id: true,
        paidAt: true,
        quantity: true,
        totalAmount: true,
      },
      orderBy: [desc(orders.createdAt)],
      where: and(
        eq(orders.eventId, eventId),
        eq(orders.userId, session.user.id),
        eq(orders.status, "paid")
      ),
      with: {
        tier: {
          columns: {
            name: true,
            price: true,
          },
        },
      },
    }),
  ]);

  if (rsvp?.status !== "approved") {
    return Response.json(
      { message: "No approved RSVP found" },
      { status: 404 }
    );
  }

  if (!event) {
    return Response.json({ message: "Event not found" }, { status: 404 });
  }

  // QR code payload: check-in URL the host scans
  const checkInPayload = JSON.stringify({
    eventId,
    url: `${appUrl}/api/events/${eventId}/check-in`,
    userId: session.user.id,
  });

  const qrDataUrl = await QRCode.toDataURL(checkInPayload, {
    color: { dark: "#000000", light: "#ffffff" },
    margin: 2,
    width: 300,
  });

  return Response.json({
    ticket: {
      endTime: event.endTime,
      eventId,
      eventSlug: event.slug,
      eventTitle: event.title,
      location: event.location,
      orders: paidOrders.map((order) => ({
        id: order.id,
        paidAt: order.paidAt,
        quantity: order.quantity,
        tierName: order.tier.name,
        totalAmount: order.totalAmount,
        unitPrice: order.tier.price,
      })),
      qrCode: qrDataUrl,
      rsvpId: rsvp.id,
      startTime: event.startTime,
      timezone: event.timezone,
      totalTickets:
        paidOrders.reduce((total, order) => total + order.quantity, 0) || 1,
      userEmail: session.user.email,
      userName: session.user.name,
    },
  });
}
