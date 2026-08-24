import { formatInTimeZone } from "date-fns-tz";
import { and, desc, eq } from "drizzle-orm";
import { ArrowUpRight, Calendar, QrCode, Ticket } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShareEventButton } from "@/components/events/share-event-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, rsvps } from "@/lib/db/schema";

function formatRwf(amount: number): string {
  return `RWF ${amount.toLocaleString("en-RW")}`;
}

function eventHref(event: { id: string; slug: string | null }) {
  return event.slug ? `/e/${event.slug}` : `/events/${event.id}`;
}

function statusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    default:
      return "Pending";
  }
}

export default async function MyTicketsPage() {
  const session = await getSession(await headers());
  if (!session?.user) {
    redirect("/sign-in");
  }

  const [myOrders, approvedRsvps] = await Promise.all([
    db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      where: eq(orders.userId, session.user.id),
      with: {
        event: {
          columns: {
            id: true,
            slug: true,
            startTime: true,
            timezone: true,
            title: true,
          },
        },
        tier: { columns: { name: true } },
      },
    }),
    db.query.rsvps.findMany({
      orderBy: [desc(rsvps.createdAt)],
      where: and(
        eq(rsvps.userId, session.user.id),
        eq(rsvps.status, "approved")
      ),
      with: {
        event: {
          columns: {
            id: true,
            slug: true,
            startTime: true,
            timezone: true,
            title: true,
          },
        },
      },
    }),
  ]);

  const paidEventIds = new Set(
    myOrders
      .filter((order) => order.status === "paid")
      .map((order) => order.eventId)
  );
  const freeTickets = approvedRsvps.filter(
    (rsvp) => !paidEventIds.has(rsvp.eventId)
  );
  const hasTickets = myOrders.length > 0 || freeTickets.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">My Tickets</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Every ticket you&apos;ve bought or claimed, in one place.
        </p>
      </div>

      {!hasTickets ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Ticket className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold">No tickets yet</p>
            <p className="max-w-xs text-muted-foreground text-sm">
              Tickets you buy or claim will appear here with their QR codes.
            </p>
            <Button asChild className="mt-2">
              <Link href="/events">Browse events</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {myOrders.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {myOrders.map((order) => {
                const isPaid = order.status === "paid";
                const href = eventHref(order.event);
                return (
                  <Card className="gap-4 py-4" key={order.id}>
                    <CardHeader className="px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <Link
                            className="block truncate font-semibold hover:underline"
                            href={href}
                          >
                            {order.event.title}
                          </Link>
                          <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatInTimeZone(
                              order.event.startTime,
                              order.event.timezone,
                              "EEE, MMM d, yyyy 'at' h:mm a"
                            )}
                          </p>
                        </div>
                        <Badge variant={isPaid ? "default" : "secondary"}>
                          {statusLabel(order.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 px-4">
                      <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3 text-center text-xs">
                        <div>
                          <p className="text-muted-foreground">Tier</p>
                          <p className="mt-0.5 truncate font-medium">
                            {order.tier.name}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Qty</p>
                          <p className="mt-0.5 font-medium">{order.quantity}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="mt-0.5 font-medium">
                            {formatRwf(order.totalAmount)}
                          </p>
                        </div>
                      </div>
                      <ShareEventButton
                        className="w-full justify-start"
                        eventTitle={order.event.title}
                        url={href}
                        variant="outline"
                      />
                    </CardContent>
                    <CardFooter className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-2">
                      {isPaid ? (
                        <>
                          <Button asChild className="w-full">
                            <Link href={`/ticket/${order.event.id}`}>
                              <QrCode className="mr-2 h-4 w-4" />
                              View ticket
                            </Link>
                          </Button>
                          <Button asChild className="w-full" variant="outline">
                            <Link href={`/orders/${order.id}`}>
                              Order details
                              <ArrowUpRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </>
                      ) : (
                        <Button
                          asChild
                          className="w-full sm:col-span-2"
                          variant="outline"
                        >
                          <Link href={`/orders/${order.id}`}>
                            Complete payment
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : null}

          {freeTickets.length > 0 ? (
            <div className="space-y-3">
              <div>
                <h2 className="font-semibold text-lg">Free registrations</h2>
                <p className="text-muted-foreground text-sm">
                  Approved RSVP tickets that did not require payment.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {freeTickets.map((rsvp) => {
                  const href = eventHref(rsvp.event);
                  return (
                    <Card className="gap-4 py-4" key={rsvp.id}>
                      <CardHeader className="px-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <Link
                              className="block truncate font-semibold hover:underline"
                              href={href}
                            >
                              {rsvp.event.title}
                            </Link>
                            <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatInTimeZone(
                                rsvp.event.startTime,
                                rsvp.event.timezone,
                                "EEE, MMM d, yyyy 'at' h:mm a"
                              )}
                            </p>
                          </div>
                          <Badge>Approved</Badge>
                        </div>
                      </CardHeader>
                      <CardFooter className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-2">
                        <Button asChild className="w-full">
                          <Link href={`/ticket/${rsvp.event.id}`}>
                            <QrCode className="mr-2 h-4 w-4" />
                            View ticket
                          </Link>
                        </Button>
                        <ShareEventButton
                          className="w-full"
                          eventTitle={rsvp.event.title}
                          url={href}
                          variant="outline"
                        />
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
