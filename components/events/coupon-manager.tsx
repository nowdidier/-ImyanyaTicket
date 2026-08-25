"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Coupon {
  active: boolean;
  code: string;
  expiresAt: string | null;
  id: string;
  maxRedemptions: number | null;
  timesRedeemed: number;
  type: "percent" | "fixed";
  value: number;
}

interface CouponFormState {
  code: string;
  expiresAt: string;
  maxRedemptions: string;
  type: "percent" | "fixed";
  value: string;
}

const emptyForm: CouponFormState = {
  code: "",
  expiresAt: "",
  maxRedemptions: "",
  type: "percent",
  value: "",
};

function couponLabel(coupon: Coupon): string {
  return coupon.type === "percent"
    ? `${coupon.value}% off`
    : `RWF ${coupon.value.toLocaleString("en-RW")} off`;
}

export function CouponManager({ eventId }: { eventId: string }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormState>(emptyForm);

  const loadCoupons = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/coupons`);
      if (!res.ok) {
        throw new Error("Failed to load coupons");
      }
      setCoupons(await res.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(coupon: Coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 16) : "",
      maxRedemptions:
        coupon.maxRedemptions === null ? "" : String(coupon.maxRedemptions),
      type: coupon.type,
      value: String(coupon.value),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.code.trim()) {
      toast.error("Coupon code is required");
      return;
    }
    const value = Number.parseInt(form.value, 10);
    if (Number.isNaN(value) || value < 1) {
      toast.error(
        form.type === "percent"
          ? "Enter a percentage between 1 and 100"
          : "Enter a discount amount in RWF"
      );
      return;
    }
    if (form.type === "percent" && value > 100) {
      toast.error("Percentage cannot exceed 100");
      return;
    }

    setSaving(true);
    try {
      const maxRedemptions = Number.parseInt(form.maxRedemptions, 10);
      const payload: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value,
        ...(form.maxRedemptions && !Number.isNaN(maxRedemptions)
          ? { maxRedemptions }
          : {}),
        ...(form.expiresAt
          ? { expiresAt: new Date(form.expiresAt).toISOString() }
          : {}),
      };
      const res = await fetch(
        editingId
          ? `/api/events/${eventId}/coupons/${editingId}`
          : `/api/events/${eventId}/coupons`,
        {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: editingId ? "PATCH" : "POST",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Failed to save coupon");
        return;
      }
      toast.success(editingId ? "Coupon updated" : "Coupon created");
      setDialogOpen(false);
      await loadCoupons();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(coupon: Coupon) {
    try {
      const res = await fetch(`/api/events/${eventId}/coupons/${coupon.id}`, {
        body: JSON.stringify({ active: !coupon.active }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message ?? "Failed to update coupon");
        return;
      }
      await loadCoupons();
    } catch {
      toast.error("Something went wrong");
    }
  }

  async function handleDelete() {
    if (!deletingId) {
      return;
    }
    try {
      const res = await fetch(`/api/events/${eventId}/coupons/${deletingId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "Failed to delete coupon");
        return;
      }
      toast.success("Coupon deleted");
      await loadCoupons();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Coupons</h2>
          <p className="text-muted-foreground text-sm">
            Discount codes buyers can apply at checkout.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add coupon
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {!loading && coupons.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          No coupons yet. Create one for early-bird or promo pricing.
        </p>
      ) : null}
      {!loading && coupons.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          {coupons.map((coupon) => (
            <div
              className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0"
              key={coupon.id}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <span className="font-mono">{coupon.code}</span>
                  {!coupon.active && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </p>
                <p className="truncate text-muted-foreground text-xs">
                  {couponLabel(coupon)} · used {coupon.timesRedeemed}
                  {coupon.maxRedemptions !== null
                    ? `/${coupon.maxRedemptions}`
                    : ""}
                  {coupon.expiresAt
                    ? ` · expires ${new Date(coupon.expiresAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  aria-label={
                    coupon.active ? "Deactivate coupon" : "Activate coupon"
                  }
                  checked={coupon.active}
                  onCheckedChange={() => handleToggleActive(coupon)}
                />
                <Button
                  onClick={() => openEdit(coupon)}
                  size="sm"
                  variant="outline"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => setDeletingId(coupon.id)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit coupon" : "Add coupon"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-code">Code</Label>
              <Input
                className="uppercase"
                id="coupon-code"
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="EARLYBIRD"
                value={form.code}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  onValueChange={(v) =>
                    setForm({ ...form, type: v as "percent" | "fixed" })
                  }
                  value={form.type}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (RWF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-value">
                  {form.type === "percent" ? "Percent off" : "Amount off (RWF)"}
                </Label>
                <Input
                  id="coupon-value"
                  min={1}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.type === "percent" ? "10" : "2000"}
                  type="number"
                  value={form.value}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="coupon-max">Max uses</Label>
                <Input
                  id="coupon-max"
                  min={1}
                  onChange={(e) =>
                    setForm({ ...form, maxRedemptions: e.target.value })
                  }
                  placeholder="∞"
                  type="number"
                  value={form.maxRedemptions}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-expires">Expires</Label>
                <Input
                  id="coupon-expires"
                  onChange={(e) =>
                    setForm({ ...form, expiresAt: e.target.value })
                  }
                  type="datetime-local"
                  value={form.expiresAt}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              {editingId ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setDeletingId(null)}
        open={deletingId !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this coupon?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Buyers will no longer be able to use it. Past orders keep their
            discounts.
          </p>
          <DialogFooter>
            <Button onClick={() => setDeletingId(null)} variant="ghost">
              Cancel
            </Button>
            <Button onClick={handleDelete} variant="destructive">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
