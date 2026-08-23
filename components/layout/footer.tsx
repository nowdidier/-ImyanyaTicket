import Link from "next/link";
import { Logo } from "@/components/logo";
import { Separator } from "@/components/ui/separator";

const footerLinks = {
  legal: [
    { href: "#", label: "Privacy Policy" },
    { href: "#", label: "Terms of Service" },
    { href: "#", label: "Refund Policy" },
  ],
  product: [
    { href: "/events", label: "Browse Events" },
    { href: "/sign-up", label: "Sell Tickets" },
    { href: "/sign-up", label: "AI Assistant" },
    { href: "#", label: "Pricing" },
  ],
  resources: [
    { href: "#", label: "Documentation" },
    { href: "#", label: "API Reference" },
    { href: "#", label: "Changelog" },
    { href: "#", label: "Help Center" },
  ],
};

const sections = [
  { links: footerLinks.product, title: "Product" },
  { links: footerLinks.resources, title: "Resources" },
  { links: footerLinks.legal, title: "Legal" },
];

export function Footer() {
  return (
    <footer
      className="w-full border-border border-t bg-background"
      role="contentinfo"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8 lg:py-20">
          {/* Brand column */}
          <div className="flex flex-col gap-6 sm:col-span-2 lg:col-span-4">
            <Link aria-label="Go to home page" href="/">
              <Logo className="h-4" />
            </Link>
            <p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
              Rwanda's modern event ticketing platform. Discover events, buy
              tickets securely, and receive your QR ticket via WhatsApp and
              email.
            </p>
          </div>

          {/* Navigation columns */}
          <nav
            aria-label="Footer navigation"
            className="col-span-1 grid grid-cols-2 gap-8 sm:col-span-2 sm:grid-cols-3 lg:col-span-8 lg:gap-12"
          >
            {sections.map((section) => (
              <div className="flex flex-col gap-3" key={section.title}>
                <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  {section.title}
                </h4>
                <ul className="flex flex-col gap-2.5">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        className="text-foreground/80 text-sm transition-colors hover:text-foreground"
                        href={link.href}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <Separator aria-hidden="true" role="presentation" />

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 py-6 sm:flex-row">
          <p className="text-muted-foreground text-xs">
            &copy; {new Date().getFullYear()} Imyanya Tickets. All rights
            reserved.
          </p>
          <p className="text-muted-foreground text-xs">
            A part of Imyanya.rw. Built with Next.js & shadcn/ui.
          </p>
        </div>
      </div>
    </footer>
  );
}
