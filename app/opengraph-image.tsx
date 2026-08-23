import { renderBrandOgImage } from "@/lib/seo/brand-og-image";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/seo/event-og-image";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Imyanya Tickets — Discover. Buy. Pay. Get Your Ticket.";

export default function Image() {
  return renderBrandOgImage({
    subtitle:
      "Create events, sell tickets, and deliver secure QR tickets via WhatsApp and email.",
    title: "Discover. Buy. Pay. Get Your Ticket.",
  });
}
