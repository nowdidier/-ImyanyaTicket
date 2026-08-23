import type { NextRequest } from "next/server";
import { handleRwandaPayWebhook } from "@/lib/rwandapay-webhook";

export function POST(request: NextRequest) {
  return handleRwandaPayWebhook(request);
}
