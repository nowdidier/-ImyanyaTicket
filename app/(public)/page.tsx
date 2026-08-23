import type { Metadata } from "next";
import { CtaSection } from "@/components/layout/cta-section";
import { FeatureCards } from "@/components/layout/feature-cards";
import { HeroSection } from "@/components/layout/hero-section";
import { HowItWorks } from "@/components/layout/how-it-works";
import { PixelParagraph } from "@/components/ui/pixel-paragraph-words";
import { buildPageMetadata } from "@/lib/seo/metadata";

const HOME_DESCRIPTION =
  "Discover events and buy tickets securely on Imyanya Tickets. Create events, manage ticket types and pricing, and deliver QR tickets via WhatsApp and email.";

export const metadata: Metadata = buildPageMetadata({
  description: HOME_DESCRIPTION,
  // `app/opengraph-image.tsx` lives on an ancestor segment, so it is dropped by
  // this page's own `openGraph` unless pointed at explicitly.
  images: ["/opengraph-image"],
  path: "/",
  // Title is intentionally omitted: the root layout supplies the default
  // (untemplated) one, and setting it here would render "… · Imyanya Tickets".
});

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <HeroSection />

      {/* Features */}
      <section className="border-t bg-muted/30 py-24" id="features">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="font-bold text-3xl tracking-tight sm:text-4xl">
              Everything you need to sell tickets
            </h2>
            <PixelParagraph
              className="mt-4 text-muted-foreground"
              font="circle"
              pixelWordClassName="text-foreground"
              pixelWords={["creation to check-in", "QR tickets"]}
              text="From event creation to venue check-in, Imyanya Tickets handles the entire ticketing lifecycle."
            />
          </div>
          <FeatureCards />
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="font-bold text-3xl tracking-tight sm:text-4xl">
              Up and selling in minutes
            </h2>
            <p className="mt-4 text-muted-foreground">
              No complex setup. Start selling tickets today.
            </p>
          </div>
          <HowItWorks />
        </div>
      </section>

      {/* Sell tickets CTA */}
      <CtaSection />
    </div>
  );
}
