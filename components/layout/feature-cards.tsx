import {
  BadgePercent,
  BarChart3,
  CreditCard,
  QrCode,
  ScanLine,
  Ticket,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PixelParagraph } from "@/components/ui/pixel-paragraph-words";

const features = [
  {
    description:
      "Offer multiple ticket types with custom pricing, seat selection, and capacity limits per tier.",
    icon: Ticket,
    pixelWords: ["ticket types", "pricing"],
    title: "Ticket Types & Pricing",
  },
  {
    description:
      "Customers pay securely online and receive their digital ticket instantly.",
    icon: CreditCard,
    pixelWords: ["pay securely", "instantly"],
    title: "Secure Payments",
  },
  {
    description:
      "Every buyer gets a digital ticket with a unique QR code, delivered via WhatsApp and email.",
    icon: QrCode,
    pixelWords: ["QR code", "WhatsApp"],
    title: "QR Ticket Delivery",
  },
  {
    description:
      "Validate tickets at the venue with QR-code scanning and an audit trail.",
    icon: ScanLine,
    pixelWords: ["scanning", "audit trail"],
    title: "Check-in & Validation",
  },
  {
    description:
      "Track sales, attendance, and revenue with live analytics for every event.",
    icon: BarChart3,
    pixelWords: ["sales", "attendance"],
    title: "Sales Analytics",
  },
  {
    description:
      "Drive bookings with promo codes, early-bird discounts, and group pricing.",
    icon: BadgePercent,
    pixelWords: ["promo codes", "discounts"],
    title: "Promo Codes & Discounts",
  },
];

export function FeatureCards() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {features.map(({ icon: Icon, title, description, pixelWords }) => (
        <Card
          className="border border-border bg-background shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-foreground hover:shadow-md"
          key={title}
        >
          <CardContent className="pt-6">
            <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-5 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <PixelParagraph
              className="mt-2 text-muted-foreground text-sm leading-relaxed"
              font="circle"
              pixelWordClassName="text-foreground"
              pixelWords={pixelWords}
              text={description}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
