import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const API_BASE_URL =
  process.env.RWANDAPAY_API_BASE_URL ?? "https://pay.rwandapay.rw/api/v1";

interface Credentials {
  publicKey: string;
  secretKey: string;
}

function createCredentials(): Credentials | null {
  const publicKey = process.env.RWANDAPAY_PUBLIC_KEY;
  const secretKey = process.env.RWANDAPAY_SECRET_KEY;
  if (!(publicKey && secretKey)) {
    return null;
  }
  return { publicKey, secretKey };
}

const credentials = createCredentials();

export const isRwandaPayConfigured = credentials !== null;

export interface RwandaPayCustomer {
  email?: string;
  name: string;
  phone: string;
}

export interface CreateCollectionInput {
  amount: number;
  customer: RwandaPayCustomer;
  description: string;
  expiresAt?: Date;
  metadata?: Record<string, string>;
  redirectUrl?: string;
  reference: string;
  webhookUrl?: string;
}

export interface RwandaPayCollection {
  amount: number;
  currency: string;
  fee: number | null;
  netAmount: number | null;
  paidAt: string | null;
  paymentUrl: string | null;
  reference: string;
  status: string;
}

export interface RwandaPayCollectionStatus {
  amount: number;
  amountPaid: number;
  currency: string;
  isExpired: boolean;
  isFailed: boolean;
  isPaid: boolean;
  isPending: boolean;
  paymentMethod: string | null;
  reference: string;
  status: string;
}

export interface RwandaPayWebhookEvent {
  amount: number | null;
  createdAt: string | null;
  eventId: string;
  eventKind: string;
  network: string | null;
  paypackReference: string | null;
  reference: string | null;
  status: string | null;
}

interface ApiErrorShape {
  error?: { code?: string; message?: string };
  success: false;
}

async function rwandaPayFetch<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {}
): Promise<T> {
  if (!credentials) {
    throw new Error(
      "RwandaPay is not configured. Set RWANDAPAY_PUBLIC_KEY and RWANDAPAY_SECRET_KEY."
    );
  }

  const { idempotencyKey, headers, ...rest } = init;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "X-Public-Key": credentials.publicKey,
      "X-Secret-Key": credentials.secretKey,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(20_000),
  });

  const body = (await response.json().catch(() => null)) as
    | (T & { success?: boolean })
    | ApiErrorShape
    | null;

  if (!response.ok || (body && body.success === false)) {
    const err = (body as ApiErrorShape | null)?.error;
    throw new Error(
      `RwandaPay ${response.status}${err?.code ? ` ${err.code}` : ""}: ${
        err?.message ?? "Request failed"
      }`
    );
  }

  return body as T;
}

export async function createCollection(
  input: CreateCollectionInput
): Promise<RwandaPayCollection> {
  const data = await rwandaPayFetch<{ data: Record<string, unknown> }>(
    "/collections",
    {
      body: JSON.stringify({
        amount: input.amount,
        currency: "RWF",
        customer: input.customer,
        description: input.description,
        reference: input.reference,
        ...(input.redirectUrl ? { redirect_url: input.redirectUrl } : {}),
        ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
        ...(input.expiresAt
          ? { expires_at: input.expiresAt.toISOString() }
          : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      }),
      idempotencyKey: randomUUID(),
      method: "POST",
    }
  );

  return mapCollection(data.data);
}

export async function getCollection(
  reference: string
): Promise<RwandaPayCollection> {
  const data = await rwandaPayFetch<{ data: Record<string, unknown> }>(
    `/collections/${encodeURIComponent(reference)}`
  );
  return mapCollection(data.data);
}

export async function getCollectionStatus(
  reference: string
): Promise<RwandaPayCollectionStatus> {
  const data = await rwandaPayFetch<{
    data: {
      reference: string;
      collection_status: string;
      is_paid: boolean;
      is_pending: boolean;
      is_failed: boolean;
      is_expired: boolean;
      amount: number;
      amount_paid: number;
      currency: string;
      payment_method: string | null;
    };
  }>(`/collections/${encodeURIComponent(reference)}/status`);

  return {
    amount: data.data.amount,
    amountPaid: data.data.amount_paid,
    currency: data.data.currency,
    isExpired: data.data.is_expired,
    isFailed: data.data.is_failed,
    isPaid: data.data.is_paid,
    isPending: data.data.is_pending,
    paymentMethod: data.data.payment_method,
    reference: data.data.reference,
    status: data.data.collection_status,
  };
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapCollection(raw: Record<string, unknown>): RwandaPayCollection {
  return {
    amount: toNumberOrNull(raw.amount) ?? 0,
    currency: toStringOrNull(raw.currency) ?? "RWF",
    fee: toNumberOrNull(raw.fee),
    netAmount: toNumberOrNull(raw.net_amount),
    paidAt: toStringOrNull(raw.paid_at),
    paymentUrl: toStringOrNull(raw.payment_url),
    reference: toStringOrNull(raw.reference) ?? "",
    status: toStringOrNull(raw.status) ?? "",
  };
}

export function parseRwandaPayWebhook(rawBody: string): RwandaPayWebhookEvent {
  const payload = JSON.parse(rawBody) as Record<string, unknown>;

  // RwandaPay sends two shapes: flat docs format (event_kind + top-level
  // fields) and dashboard format (event + nested data object).
  const nested =
    typeof payload.event === "string" && payload.data instanceof Object
      ? (payload.data as Record<string, unknown>)
      : null;

  return {
    amount:
      toNumberOrNull(payload.amount) ??
      (nested ? toNumberOrNull(nested.amount) : null),
    createdAt:
      toStringOrNull(payload.created_at) ??
      toStringOrNull(payload.timestamp) ??
      (nested ? toStringOrNull(nested.created_at) : null),
    eventId: toStringOrNull(payload.event_id) ?? "",
    eventKind:
      toStringOrNull(payload.event_kind) ?? toStringOrNull(payload.event) ?? "",
    network: toStringOrNull(payload.network),
    paypackReference: toStringOrNull(payload.paypack_reference),
    reference:
      toStringOrNull(payload.reference) ??
      toStringOrNull(payload.paypack_reference) ??
      (nested ? toStringOrNull(nested.reference) : null),
    status:
      toStringOrNull(payload.status) ??
      (nested ? toStringOrNull(nested.status) : null),
  };
}

export function verifyRwandaPayWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.RWANDAPAY_WEBHOOK_SECRET;
  if (!(secret && signature)) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  const provided = Buffer.from(signature.trim());
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(provided, expectedBuf);
}
