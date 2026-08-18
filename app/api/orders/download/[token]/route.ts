import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import {
  hashDigitalDownloadToken,
  photoDownloadName,
} from "@/lib/server/photo-download";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function invalidLink() {
  return jsonError("Nedladdningslänken är ogiltig eller har gått ut", 404);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!TOKEN_PATTERN.test(token)) return invalidLink();

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select(
      "photo_title, product_type, original_storage_path, digital_delivery_token_expires_at"
    )
    .eq("digital_delivery_token_hash", hashDigitalDownloadToken(token))
    .maybeSingle();

  if (error) {
    console.error("Digital download lookup failed", { message: error.message });
    return invalidLink();
  }
  if (
    !order ||
    order.product_type !== "digital" ||
    !order.original_storage_path ||
    !order.digital_delivery_token_expires_at ||
    new Date(order.digital_delivery_token_expires_at).getTime() <= Date.now()
  ) {
    return invalidLink();
  }

  const { data, error: signedUrlError } = await admin.storage
    .from(STORAGE_BUCKETS.originals)
    .createSignedUrl(order.original_storage_path, 60, {
      download: photoDownloadName(order.photo_title, order.original_storage_path),
    });

  if (signedUrlError) {
    console.error("Digital download signing failed", {
      message: signedUrlError.message,
    });
    return jsonError("Originalbilden kunde inte hämtas", 500);
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
