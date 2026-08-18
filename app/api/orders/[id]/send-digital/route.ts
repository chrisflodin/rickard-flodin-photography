import { Resend } from "resend";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getSiteUrl } from "@/lib/constants";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";
import {
  createDigitalDownloadToken,
  digitalDownloadExpiresAt,
  DIGITAL_DOWNLOAD_VALIDITY_DAYS,
  hashDigitalDownloadToken,
} from "@/lib/server/photo-download";

const orderIdSchema = z.string().uuid();
const STALE_DELIVERY_MINUTES = 10;
const deliveryOrderSelect =
  "id, invoice_number, photo_title, product_type, customer_name, customer_email, original_storage_path, digital_delivery_status, digital_delivery_started_at";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const parsedId = orderIdSchema.safeParse((await params).id);
  if (!parsedId.success) return jsonError("Ogiltigt beställnings-id", 400);

  const admin = createAdminClient();
  const token = createDigitalDownloadToken();
  const tokenHash = hashDigitalDownloadToken(token);
  const expiresAt = digitalDownloadExpiresAt();
  const startedAt = new Date().toISOString();
  const deliveryUpdate = {
    digital_delivery_status: "sending",
    digital_delivery_token_hash: tokenHash,
    digital_delivery_token_expires_at: expiresAt,
    digital_delivery_started_at: startedAt,
    digital_delivery_error: null,
  };

  let { data: order, error: claimError } = await admin
    .from("orders")
    .update(deliveryUpdate)
    .eq("id", parsedId.data)
    .eq("product_type", "digital")
    .not("original_storage_path", "is", null)
    .in("digital_delivery_status", ["not_sent", "failed", "sent"])
    .select(deliveryOrderSelect)
    .maybeSingle();

  if (claimError) return jsonError(claimError.message, 500);

  if (!order) {
    const { data: current, error: currentError } = await admin
      .from("orders")
      .select(deliveryOrderSelect)
      .eq("id", parsedId.data)
      .maybeSingle();

    if (currentError) return jsonError(currentError.message, 500);
    if (!current) return jsonError("Beställningen kunde inte hittas", 404);
    if (current.product_type !== "digital") {
      return jsonError("Endast digitala beställningar kan skickas", 409);
    }
    if (!current.original_storage_path) {
      return jsonError("Originalfilen kunde inte hittas", 409);
    }

    const staleBefore = new Date(
      Date.now() - STALE_DELIVERY_MINUTES * 60 * 1000
    ).toISOString();
    if (
      current.digital_delivery_started_at &&
      current.digital_delivery_started_at >= staleBefore
    ) {
      return jsonError("Ett digitalt utskick pågår redan", 409);
    }

    const recoveryResult = await admin
      .from("orders")
      .update(deliveryUpdate)
      .eq("id", parsedId.data)
      .eq("product_type", "digital")
      .eq("digital_delivery_status", "sending")
      .not("original_storage_path", "is", null)
      .or(
        `digital_delivery_started_at.is.null,digital_delivery_started_at.lt.${staleBefore}`
      )
      .select(deliveryOrderSelect)
      .maybeSingle();
    order = recoveryResult.data;
    claimError = recoveryResult.error;

    if (claimError) return jsonError(claimError.message, 500);
    if (!order) return jsonError("Ett digitalt utskick pågår redan", 409);
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;
  if (!resendApiKey || !resendFrom) {
    await admin
      .from("orders")
      .update({
        digital_delivery_status: "failed",
        digital_delivery_error: "Digital delivery email is not configured",
      })
      .eq("id", order.id)
      .eq("digital_delivery_token_hash", tokenHash);
    return jsonError("Digital leverans via e-post är inte konfigurerad", 503);
  }

  const downloadUrl = `${getSiteUrl()}/api/orders/download/${token}`;

  try {
    const resend = new Resend(resendApiKey);
    const result = await resend.emails.send({
      from: resendFrom,
      to: [order.customer_email],
      subject: `Din digitala bild – ${order.photo_title}`,
      html: `
        <p>Hej ${escapeHtml(order.customer_name)},</p>
        <p>Din digitala bild “${escapeHtml(order.photo_title)}” är redo att hämtas.</p>
        <p><a href="${downloadUrl}">Hämta originalbilden</a></p>
        <p>Länken är personlig och giltig i ${DIGITAL_DOWNLOAD_VALIDITY_DAYS} dagar.</p>
        <p>Med vänlig hälsning,<br>Rickard Flodin</p>
      `,
    });
    if (result.error) throw new Error(result.error.message);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Digital delivery failed";
    await admin
      .from("orders")
      .update({
        digital_delivery_status: "failed",
        digital_delivery_error: message.slice(0, 500),
      })
      .eq("id", order.id)
      .eq("digital_delivery_token_hash", tokenHash);
    console.error("Digital order delivery failed", { orderId: order.id, message });
    return jsonError("Den digitala bilden kunde inte skickas", 502);
  }

  const sentAt = new Date().toISOString();
  const { error: statusError } = await admin
    .from("orders")
    .update({
      digital_delivery_status: "sent",
      digital_delivery_sent_at: sentAt,
      digital_delivery_error: null,
    })
    .eq("id", order.id)
    .eq("digital_delivery_token_hash", tokenHash);

  if (statusError) {
    console.error("Digital delivery status update failed", {
      orderId: order.id,
      message: statusError.message,
    });
  }

  return jsonOk({ status: "sent" as const, sent_at: sentAt });
}
