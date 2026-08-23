"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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

interface Tier {
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

interface TierFormState {
  description: string;
  maxPerOrder: string;
  name: string;
  price: string;
  quantity: string;
  salesEnd: string;
  salesStart: string;
}

const emptyForm: TierFormState = {
  description: "",
  maxPerOrder: "10",
  name: "",
  price: "",
  quantity: "",
  salesEnd: "",
  salesStart: "",
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) {
    return "";
  }
  return iso.slice(0, 16);
}

export function TicketTierManager({ eventId }: { eventId: string }) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [deletingTierId, setDeletingTierId] = useState<string | null>(null);
  const [form, setForm] = useState<TierFormState>(emptyForm);

  const loadTiers = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/tiers`);
      if (!res.ok) {
        throw new Error("Failed to load ticket tiers");
      }
      setTiers(await res.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadTiers();
  }, [loadTiers]);

  function openCreate() {
    setEditingTierId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(tier: Tier) {
    setEditingTierId(tier.id);
    setForm({
      description: tier.description ?? "",
      maxPerOrder: String(tier.maxPerOrder),
      name: tier.name,
      price: String(tier.price),
      quantity: tier.quantity === null ? "" : String(tier.quantity),
      salesEnd: toDatetimeLocal(tier.salesEnd),
      salesStart: toDatetimeLocal(tier.salesStart),
    });
    setDialogOpen(true);
  }

  function validateForm(): string | null {
    if (!form.name.trim()) {
      return "Ticket name is required";
    }
    const price = Number.parseInt(form.price, 10);
    if (Number.isNaN(price) || price < 0) {
      return "Enter a valid price in RWF";
    }
    return null;
  }

  function buildPayload(): Record<string, unknown> {
    const quantity = Number.parseInt(form.quantity, 10);
    return {
      maxPerOrder: Number.parseInt(form.maxPerOrder, 10) || 10,
      name: form.name.trim(),
      price: Number.parseInt(form.price, 10),
      ...(form.description ? { description: form.description.trim() } : {}),
      ...(form.quantity ? { quantity } : {}),
      ...(form.salesStart
        ? { salesStart: new Date(form.salesStart).toISOString() }
        : {}),
      ...(form.salesEnd
        ? { salesEnd: new Date(form.salesEnd).toISOString() }
        : {}),
    };
  }

  async function handleSave() {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      const res = await fetch(
        editingTierId
          ? `/api/events/${eventId}/tiers/${editingTierId}`
          : `/api/events/${eventId}/tiers`,
        {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: editingTierId ? "PATCH" : "POST",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Failed to save ticket");
        return;
      }
      toast.success(editingTierId ? "Ticket updated" : "Ticket created");
      setDialogOpen(false);
      await loadTiers();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingTierId) {
      return;
    }
    try {
      const res = await fetch(
        `/api/events/${eventId}/tiers/${deletingTierId}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "Failed to delete ticket");
        return;
      }
      toast.success("Ticket deleted");
      await loadTiers();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeletingTierId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Tickets & Pricing</h2>
          <p className="text-muted-foreground text-sm">
            Create ticket tiers and prices. Buyers pay via MTN MoMo or Airtel
            Money.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add ticket
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {!loading && tiers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          No tickets yet. This event is free-entry until you add one.
        </p>
      ) : null}
      {!loading && tiers.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          {tiers.map((tier) => (
            <div
              className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0"
              key={tier.id}
            >
              <div className="min-w-0">
                <p className="font-medium">{tier.name}</p>
                <p className="truncate text-muted-foreground text-xs">
                  RWF {tier.price.toLocaleString("en-RW")} ·{" "}
                  {tier.remaining === null
                    ? `${tier.sold} sold`
                    : `${tier.sold}/${tier.quantity} sold`}
                  {" · "}
                  max {tier.maxPerOrder}/order
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  onClick={() => openEdit(tier)}
                  size="sm"
                  variant="outline"
                >
                  Edit
                </Button>
                <Button
                  disabled={tier.sold > 0}
                  onClick={() => setDeletingTierId(tier.id)}
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
              {editingTierId ? "Edit ticket" : "Add ticket"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tier-name">Name</Label>
              <Input
                id="tier-name"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Regular"
                value={form.name}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tier-price">Price (RWF)</Label>
                <Input
                  id="tier-price"
                  min={0}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="10000"
                  type="number"
                  value={form.price}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tier-qty">Quantity</Label>
                <Input
                  id="tier-qty"
                  min={1}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                  placeholder="∞"
                  type="number"
                  value={form.quantity}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tier-max">Max/order</Label>
                <Input
                  id="tier-max"
                  min={1}
                  onChange={(e) =>
                    setForm({ ...form, maxPerOrder: e.target.value })
                  }
                  type="number"
                  value={form.maxPerOrder}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tier-sales-start">Sales start</Label>
                <Input
                  id="tier-sales-start"
                  onChange={(e) =>
                    setForm({ ...form, salesStart: e.target.value })
                  }
                  type="datetime-local"
                  value={form.salesStart}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tier-sales-end">Sales end</Label>
                <Input
                  id="tier-sales-end"
                  onChange={(e) =>
                    setForm({ ...form, salesEnd: e.target.value })
                  }
                  type="datetime-local"
                  value={form.salesEnd}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tier-desc">Description</Label>
              <Input
                id="tier-desc"
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Front row seating"
                value={form.description}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              {editingTierId ? "Save changes" : "Create ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setDeletingTierId(null)}
        open={deletingTierId !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this ticket?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Buyers will no longer see this option. This cannot be undone.
          </p>
          <DialogFooter>
            <Button onClick={() => setDeletingTierId(null)} variant="ghost">
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
