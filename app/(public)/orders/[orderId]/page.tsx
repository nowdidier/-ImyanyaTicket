import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatus } from "@/components/events/order-status";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const session = await getSession(await headers()).catch(() => null);
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=/orders/${orderId}`);
  }

  const [order] = await db.query.orders.findMany({
    limit: 1,
    where: (o, { eq }) => eq(o.id, orderId),
    with: {
      event: { columns: { slug: true, title: true } },
      tier: { columns: { name: true } },
    },
  });

  if (!order || order.userId !== session.user.id) {
    notFound();
  }

  return (
    <div className="container py-8">
      <OrderStatus
        eventSlug={order.event.slug}
        eventTitle={order.event.title}
        initialOrder={{
          id: order.id,
          paidAt: order.paidAt?.toISOString() ?? null,
          quantity: order.quantity,
          status: order.status,
          totalAmount: order.totalAmount,
          unitPrice: order.unitPrice,
        }}
        tierName={order.tier.name}
      />
      <p className="text-center text-muted-foreground text-xs">
        Order reference:{" "}
        <Link className="font-mono underline" href={`/orders/${order.id}`}>
          {order.paymentReference ?? order.id}
        </Link>
      </p>
    </div>
  );
}
