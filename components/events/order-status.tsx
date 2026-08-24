"use client";

import { CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface OrderStatusData {
  id: string;
  paidAt: string | null;
  quantity: number;
  status: string;
  totalAmount: number;
  unitPrice: number;
}

interface OrderStatusProps {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  initialOrder: OrderStatusData;
  tierName: string;
}

export function OrderStatus({
  eventId,
  eventTitle,
  eventSlug,
  initialOrder,
  tierName,
}: OrderStatusProps) {
  const [order, setOrder] = useState(initialOrder);
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (order.status !== "pending" || attempts >= 100) {
      return;
    }
    timerRef.current = setTimeout(
      () => {
        fetch(`/api/orders/${initialOrder.id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) {
              setOrder(data);
            }
            setAttempts((a) => a + 1);
          })
          .catch(() => undefined);
      },
      attempts < 10 ? 3000 : 8000
    );
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [order.status, attempts, initialOrder.id]);

  const paid = order.status === "paid";
  const formatRwf = (n: number) => `RWF ${n.toLocaleString("en-RW")}`;

  if (paid) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-12 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
        <div className="space-y-2">
          <h1 className="font-bold text-3xl">Payment confirmed!</h1>
          <p className="text-muted-foreground">
            Your ticket for{" "}
            <Link
              className="text-foreground underline"
              href={`/e/${eventSlug}`}
            >
              {eventTitle}
            </Link>{" "}
            is ready.
          </p>
        </div>
        <div className="rounded-lg border p-4 text-left text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Ticket</span>
            <span>{tierName}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Quantity</span>
            <span>{order.quantity}</span>
          </div>
          <div className="flex justify-between py-1 font-medium">
            <span>Total paid</span>
            <span>{formatRwf(order.totalAmount)}</span>
          </div>
        </div>
        <Button asChild className="w-full">
          <Link href={`/ticket/${eventId}`}>View your ticket</Link>
        </Button>
        <Button asChild className="w-full" variant="outline">
          <Link href={`/e/${eventSlug}`}>Back to event</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12 text-center">
      <Clock className="mx-auto h-16 w-16 animate-pulse text-muted-foreground" />
      <div className="space-y-2">
        <h1 className="font-bold text-2xl">Waiting for payment…</h1>
        <p className="text-muted-foreground">
          Approve the payment prompt on your phone to complete your{" "}
          {formatRwf(order.totalAmount)} order for {eventTitle}.
        </p>
      </div>
      <p className="animate-pulse text-muted-foreground text-xs">
        This page updates automatically.
      </p>
    </div>
  );
}
