"use client";

import type { VariantProps } from "class-variance-authority";
import { Share2 } from "lucide-react";
import type * as React from "react";
import { toast } from "sonner";
import type { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";

interface ShareEventButtonProps
  extends VariantProps<typeof buttonVariants>,
    Omit<React.ComponentProps<"button">, "title"> {
  eventTitle: string;
  label?: string;
  title?: string;
  url: string;
}

function getAbsoluteUrl(url: string) {
  if (/^https?:\/\//.test(url)) {
    return url;
  }
  return `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
}

export function ShareEventButton({
  eventTitle,
  label = "Share",
  size,
  title = "Share event",
  url,
  variant = "outline",
  ...props
}: ShareEventButtonProps) {
  async function handleShare() {
    const shareUrl = getAbsoluteUrl(url);
    if (navigator.share) {
      try {
        await navigator.share({
          text: `Join me at ${eventTitle} on Imyanya Tickets.`,
          title: eventTitle,
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    await navigator.clipboard.writeText(shareUrl);
    toast.success("Event link copied to clipboard");
  }

  return (
    <Button
      onClick={handleShare}
      size={size}
      title={title}
      type="button"
      variant={variant}
      {...props}
    >
      <Share2 className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
