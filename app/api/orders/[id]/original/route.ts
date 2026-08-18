import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";
import { photoDownloadName } from "@/lib/server/photo-download";

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
    .select("photo_title, original_storage_path")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!order?.original_storage_path) {
    return jsonError("Originalfilen kunde inte hittas", 404);
  }

  const { data, error: signedUrlError } = await admin.storage
    .from(STORAGE_BUCKETS.originals)
    .createSignedUrl(order.original_storage_path, 60, {
      download: photoDownloadName(order.photo_title, order.original_storage_path),
    });

  if (signedUrlError) return jsonError(signedUrlError.message, 500);
  return NextResponse.redirect(data.signedUrl, 302);
}
