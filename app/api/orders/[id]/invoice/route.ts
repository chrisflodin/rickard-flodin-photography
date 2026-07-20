import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("invoice_number, invoice_path")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!order?.invoice_path) return jsonError("Fakturan kunde inte hittas", 404);

  const { data, error: signedUrlError } = await admin.storage
    .from(STORAGE_BUCKETS.invoices)
    .createSignedUrl(order.invoice_path, 60);

  if (signedUrlError) return jsonError(signedUrlError.message, 500);

  return NextResponse.redirect(data.signedUrl, 302);
}
