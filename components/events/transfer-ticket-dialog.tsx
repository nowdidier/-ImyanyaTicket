"use client";

import { ArrowLeftRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TransferTicketDialog({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleTransfer() {
    const recipientEmail = email.trim();
    if (!recipientEmail) {
      toast.error("Enter the recipient's email");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/transfer-ticket`, {
        body: JSON.stringify({ recipientEmail }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (res.status === 401) {
        toast.error("Please sign in again");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Transfer failed");
        return;
      }
      toast.success(`Ticket transferred to ${recipientEmail}`);
      setOpen(false);
      router.refresh();
      // The ticket now belongs to someone else — send them to the event page
      setTimeout(() => {
        window.location.href = `/events/${eventId}`;
      }, 1200);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Transfer ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer your ticket</DialogTitle>
          <DialogDescription>
            Your QR code stops working and the recipient gets their own ticket
            by email. Paid orders move with it. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="transfer-email">Recipient email</Label>
          <Input
            id="transfer-email"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleTransfer();
              }
            }}
            placeholder="friend@example.com"
            type="email"
            value={email}
          />
          <p className="text-muted-foreground text-xs">
            They need an Imyanya Tickets account with this email.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            disabled={loading}
            onClick={() => setOpen(false)}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button disabled={loading} onClick={handleTransfer}>
            {loading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Transferring…
              </>
            ) : (
              "Transfer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
