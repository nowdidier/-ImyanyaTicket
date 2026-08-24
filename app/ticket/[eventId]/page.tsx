"use client";

import { formatInTimeZone } from "date-fns-tz";
import {
  ArrowLeft,
  Calendar,
  Download,
  MapPin,
  Printer,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ShareEventButton } from "@/components/events/share-event-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function formatRwf(amount: number): string {
  return `RWF ${amount.toLocaleString("en-RW")}`;
}

interface TicketOrder {
  id: string;
  paidAt: string | null;
  quantity: number;
  tierName: string;
  totalAmount: number;
  unitPrice: number;
}

interface TicketData {
  endTime: string | null;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  location: string | null;
  orders: TicketOrder[];
  qrCode: string;
  rsvpId: string;
  startTime: string;
  timezone: string;
  totalTickets: number;
  userEmail: string;
  userName: string;
}

export default function TicketPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/events/${eventId}/ticket`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message ?? "Failed to load ticket");
        }
        return res.json();
      })
      .then((data) => setTicket(data.ticket))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Loading your ticket...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30">
        <Ticket className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">
          {error ?? "Ticket not available"}
        </p>
        <Button asChild variant="outline">
          <Link
            href={
              ticket?.eventSlug
                ? `/e/${ticket.eventSlug}`
                : `/events/${eventId}`
            }
          >
            Back to Event
          </Link>
        </Button>
      </div>
    );
  }

  const startTime = new Date(ticket.startTime);
  const endTime = ticket.endTime ? new Date(ticket.endTime) : null;

  function handleDownloadQrCode() {
    if (!ticket) {
      return;
    }
    const link = document.createElement("a");
    link.href = ticket.qrCode;
    link.download = `ticket-${ticket.eventTitle.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.click();
  }

  const eventUrl = ticket.eventSlug
    ? `/e/${ticket.eventSlug}`
    : `/events/${eventId}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4 print:bg-background">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-2 print:hidden">
          <Button asChild size="sm" variant="ghost">
            <Link href={eventUrl}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Event
            </Link>
          </Button>
        </div>

        <Card className="overflow-hidden shadow-xl print:shadow-none">
          <div className="bg-primary px-6 py-5 text-center">
            <p className="font-medium text-primary-foreground/70 text-xs uppercase tracking-wider">
              Imyanya Tickets
            </p>
            <h1 className="mt-2 font-bold text-2xl text-primary-foreground">
              {ticket.eventTitle}
            </h1>
          </div>

          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">
                  {formatInTimeZone(
                    startTime,
                    ticket.timezone,
                    "EEEE, MMMM d, yyyy"
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatInTimeZone(startTime, ticket.timezone, "h:mm a")}
                  {endTime
                    ? ` - ${formatInTimeZone(endTime, ticket.timezone, "h:mm a")}`
                    : ""}
                </p>
              </div>
            </div>

            {ticket.location ? (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="font-medium text-sm">{ticket.location}</p>
              </div>
            ) : null}

            <Separator />

            <div className="space-y-1 text-center">
              <p className="font-semibold text-lg">{ticket.userName}</p>
              <p className="text-muted-foreground text-sm">
                {ticket.userEmail}
              </p>
              <p className="text-muted-foreground text-sm">
                {ticket.totalTickets}{" "}
                {ticket.totalTickets === 1 ? "ticket" : "tickets"} in this
                account
              </p>
            </div>

            <div className="flex justify-center py-4">
              <img
                alt="Ticket QR Code"
                className="rounded-lg border bg-white p-3"
                height={260}
                src={ticket.qrCode}
                width={260}
              />
            </div>

            <p className="text-center text-muted-foreground text-xs">
              Present this QR code at the event for check-in
            </p>

            {ticket.orders.length > 0 ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="font-medium text-sm">Paid ticket orders</p>
                  {ticket.orders.map((order) => (
                    <div
                      className="rounded-lg border bg-muted/40 p-3 text-sm"
                      key={order.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{order.tierName}</span>
                        <span className="text-muted-foreground text-xs">
                          x{order.quantity}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                        <span className="font-mono text-muted-foreground">
                          {order.id.slice(0, 8)}
                        </span>
                        <span>{formatRwf(order.totalAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-2 print:hidden">
          <Button
            className="w-full"
            onClick={handleDownloadQrCode}
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Download QR Code
          </Button>
          <Button
            className="w-full"
            onClick={() => window.print()}
            variant="outline"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print or Save PDF
          </Button>
          <ShareEventButton
            className="w-full"
            eventTitle={ticket.eventTitle}
            url={eventUrl}
          />
        </div>
      </div>
    </div>
  );
}
