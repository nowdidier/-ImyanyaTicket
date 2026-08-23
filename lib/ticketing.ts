import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, ticketTiers } from "@/lib/db/schema";

export interface TicketTierWithAvailability {
  description: string | null;
  id: string;
  maxPerOrder: number;
  name: string;
  price: number;
  quantity: number | null;
  remaining: number | null;
  salesEnd: string | null;
  salesStart: string | null;
  sold: number;
}

export async function getSoldCountsByTier(
  eventId: string
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      sold: sql<number>`coalesce(sum(${orders.quantity}), 0)::int`,
      tierId: orders.tierId,
    })
    .from(orders)
    .where(and(eq(orders.eventId, eventId), eq(orders.status, "paid")))
    .groupBy(orders.tierId);

  return new Map(rows.map((row) => [row.tierId, Number(row.sold)]));
}

export async function listTiersWithSold(
  eventId: string
): Promise<TicketTierWithAvailability[]> {
  const [tiers, soldMap] = await Promise.all([
    db.query.ticketTiers.findMany({
      orderBy: [asc(ticketTiers.price)],
      where: eq(ticketTiers.eventId, eventId),
    }),
    getSoldCountsByTier(eventId),
  ]);

  return tiers.map((tier) => {
    const sold = soldMap.get(tier.id) ?? 0;
    return {
      description: tier.description,
      id: tier.id,
      maxPerOrder: tier.maxPerOrder,
      name: tier.name,
      price: tier.price,
      quantity: tier.quantity,
      remaining: tier.quantity === null ? null : tier.quantity - sold,
      salesEnd: tier.salesEnd?.toISOString() ?? null,
      salesStart: tier.salesStart?.toISOString() ?? null,
      sold,
    };
  });
}
