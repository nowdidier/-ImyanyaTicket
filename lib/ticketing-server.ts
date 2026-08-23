import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";

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
