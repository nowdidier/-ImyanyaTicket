import { Button, Section, Text } from "@react-email/components";
import { CardHeader, EmailLayout } from "./components/email-layout";

interface TicketTransferEmailProps {
  eventTitle: string;
  eventUrl: string;
  recipientName: string;
  ticketUrl?: string;
}

export default function TicketTransferEmail({
  eventTitle,
  eventUrl,
  recipientName,
  ticketUrl,
}: TicketTransferEmailProps) {
  return (
    <EmailLayout preview={`Your ticket for ${eventTitle} has a new owner`}>
      <CardHeader subtitle={eventTitle} title="Ticket transferred" />

      <Section className="px-[32px] py-[28px]">
        <Text className="m-0 text-[#3f3f46] text-[15px] leading-[24px]">
          Your ticket for{" "}
          <strong className="text-[#18181b]">{eventTitle}</strong> has been
          transferred to{" "}
          <strong className="text-[#18181b]">{recipientName}</strong>. Your
          original QR code is no longer valid for entry.
        </Text>

        {ticketUrl ? (
          <Section className="mt-[28px]">
            <Button
              className="box-border block w-full rounded-[10px] border border-[#e4e4e7] border-solid bg-white px-[24px] py-[14px] text-center font-semibold text-[#3f3f46] text-[15px] no-underline"
              href={ticketUrl}
            >
              View transfer details
            </Button>
          </Section>
        ) : null}

        <Text className="m-0 mt-[24px] text-[#71717a] text-[13px] leading-[20px]">
          Changed your mind? You can buy or RSVP again on the{" "}
          <a className="text-[#18181b] underline" href={eventUrl}>
            event page
          </a>
          , subject to availability.
        </Text>
      </Section>
    </EmailLayout>
  );
}

TicketTransferEmail.PreviewProps = {
  eventTitle: "Summer Product Launch",
  eventUrl: "https://tickets.imyanya.rw/e/summer-product-launch",
  recipientName: "Aline Uwase",
} satisfies TicketTransferEmailProps;

export { TicketTransferEmail };
