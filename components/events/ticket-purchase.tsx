"use client";

import { Tag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TicketTierWithAvailability } from "@/lib/ticketing";

interface TicketPurchaseProps {
  eventId: string;
  eventSlug: string;
  isAuthenticated: boolean;
  tiers: TicketTierWithAvailability[];
}

const MOMO_PHONE_RE = /^07\d{8}$/;

function formatRwf(amount: number): string {
  return `RWF ${amount.toLocaleString("en-RW")}`;
}

interface AppliedCoupon {
  code: string;
  discountAmount: number;
}

export function TicketPurchase({
  eventId,
  eventSlug,
  tiers,
  isAuthenticated,
}: TicketPurchaseProps) {
  const router = useRouter();
  const available = useMemo(
    () =>
      tiers.filter((t) => {
        if (t.remaining !== null && t.remaining <= 0) {
          return false;
        }
        if (t.salesEnd && new Date(t.salesEnd) < new Date()) {
          return false;
        }
        if (t.salesStart && new Date(t.salesStart) > new Date()) {
          return false;
        }
        return true;
      }),
    [tiers]
  );
  const [tierId, setTierId] = useState(available[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    null
  );
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const tier = available.find((t) => t.id === tierId);
  const maxQty = tier
    ? Math.min(tier.maxPerOrder, tier.remaining ?? tier.maxPerOrder)
    : 1;
  const subtotal = (tier?.price ?? 0) * quantity;

  function clearCouponIfApplied() {
    if (appliedCoupon) {
      setAppliedCoupon(null);
    }
  }

  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) {
      return;
    }
    if (!tier) {
      toast.error("Select a ticket first");
      return;
    }
    setCheckingCoupon(true);
    try {
      const res = await fetch(`/api/events/${eventId}/coupons/validate`, {
        body: JSON.stringify({ code, quantity, tierId: tier.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        toast.error(data.message ?? "Invalid coupon code");
        return;
      }
      setAppliedCoupon({
        code: code.toUpperCase(),
        discountAmount: data.discountAmount,
      });
      toast.success(`Coupon ${code.toUpperCase()} applied`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCheckingCoupon(false);
    }
  }

  async function handleBuy() {
    if (!isAuthenticated) {
      router.push(`/sign-in?callbackUrl=/e/${eventSlug}`);
      return;
    }
    if (!tier) {
      toast.error("Select a ticket first");
      return;
    }
    if (!MOMO_PHONE_RE.test(phone)) {
      toast.error("Enter a valid phone number (07XXXXXXXX)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/orders`, {
        body: JSON.stringify({
          ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
          customerPhone: phone,
          quantity,
          tierId: tier.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push(`/sign-in?callbackUrl=/e/${eventSlug}`);
        return;
      }
      if (!res.ok) {
        // A coupon rejected server-side at checkout shouldn't stick around
        if (
          typeof data.message === "string" &&
          data.message.toLowerCase().includes("coupon")
        ) {
          setAppliedCoupon(null);
        }
        toast.error(data.message ?? "Could not start checkout");
        return;
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      router.push(`/orders/${data.orderId}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (available.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-center font-medium">Tickets unavailable</p>
        <p className="text-center text-muted-foreground text-sm">
          All tickets are sold out or sales have closed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label className="font-medium text-base">Get tickets</Label>

      <div className="space-y-2">
        {available.map((t) => (
          <button
            className={`w-full rounded-lg border p-3 text-left transition-colors ${
              tierId === t.id
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
            key={t.id}
            onClick={() => {
              setTierId(t.id);
              clearCouponIfApplied();
            }}
            type="button"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.name}</span>
              <span className="font-semibold">
                {t.price === 0 ? "Free" : formatRwf(t.price)}
              </span>
            </div>
            {t.description ? (
              <p className="mt-0.5 text-muted-foreground text-xs">
                {t.description}
              </p>
            ) : null}
            {t.remaining !== null && t.remaining <= 10 ? (
              <p className="mt-1 text-destructive text-xs">
                Only {t.remaining} left!
              </p>
            ) : null}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ticket-qty">Quantity</Label>
          <Input
            id="ticket-qty"
            max={maxQty}
            min={1}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10);
              setQuantity(
                Number.isNaN(v) ? 1 : Math.min(Math.max(v, 1), maxQty)
              );
              clearCouponIfApplied();
            }}
            type="number"
            value={quantity}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ticket-phone">Phone (MoMo)</Label>
          <Input
            id="ticket-phone"
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0788123456"
            type="tel"
            value={phone}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ticket-coupon">Coupon code</Label>
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
            <span className="flex items-center gap-1.5 font-medium text-sm">
              <Tag className="h-3.5 w-3.5" />
              {appliedCoupon.code}
            </span>
            <button
              aria-label="Remove coupon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setAppliedCoupon(null)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              className="uppercase"
              id="ticket-coupon"
              onChange={(e) => setCouponInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleApplyCoupon();
                }
              }}
              placeholder="EARLYBIRD"
              value={couponInput}
            />
            <Button
              disabled={checkingCoupon || !couponInput.trim()}
              onClick={handleApplyCoupon}
              type="button"
              variant="outline"
            >
              {checkingCoupon ? "…" : "Apply"}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1 border-t pt-3">
        {appliedCoupon ? (
          <>
            <div className="flex items-center justify-between text-muted-foreground text-sm">
              <span>Subtotal</span>
              <span>{formatRwf(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-primary text-sm">
              <span>Discount ({appliedCoupon.code})</span>
              <span>-{formatRwf(appliedCoupon.discountAmount)}</span>
            </div>
          </>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Total</span>
          <span className="font-bold">
            {formatRwf(
              Math.max(subtotal - (appliedCoupon?.discountAmount ?? 0), 0)
            )}
          </span>
        </div>
      </div>

      <Button
        className="w-full"
        disabled={loading}
        onClick={handleBuy}
        size="lg"
      >
        {subtotal > 0 && subtotal - (appliedCoupon?.discountAmount ?? 0) <= 0
          ? loading
            ? "Claiming…"
            : "Claim free tickets"
          : loading
            ? "Starting…"
            : "Buy tickets"}
      </Button>
      <p className="text-center text-muted-foreground text-xs">
        Pay with MTN MoMo or Airtel Money via RwandaPay
      </p>
    </div>
  );
}
