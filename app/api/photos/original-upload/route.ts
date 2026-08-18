import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import {
  MAX_ORIGINAL_UPLOAD_BYTES,
  ORIGINAL_IMAGE_TYPES,
  STORAGE_BUCKETS,
} from "@/lib/constants";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";
import {
  cleanupExpiredOriginalUploads,
  removePendingOriginalUpload,
} from "@/lib/server/original-upload-cleanup";

const extensionByType: Record<(typeof ORIGINAL_IMAGE_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const createUploadSchema = z.object({
  content_type: z.enum(ORIGINAL_IMAGE_TYPES),
  size: z.number().int().positive().max(MAX_ORIGINAL_UPLOAD_BYTES),
});

const cleanupSchema = z.object({
  path: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i),
});

export async function GET(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const parsed = cleanupSchema.safeParse({
    path: new URL(request.url).searchParams.get("path"),
  });
  if (!parsed.success) return jsonError("Invalid original path", 400);

  const admin = createAdminClient();
  const { data: finalized, error: finalizedError } = await admin
    .from("photo_originals")
    .select("photo_id")
    .eq("storage_path", parsed.data.path)
    .maybeSingle();
  if (finalizedError) return jsonError(finalizedError.message, 500);
  if (finalized) {
    return jsonOk({ status: "finalized" as const, photo_id: finalized.photo_id });
  }

  const { data: staged, error: stagedError } = await admin
    .from("photo_original_uploads")
    .select("status")
    .eq("path", parsed.data.path)
    .eq("uploaded_by", user.id)
    .maybeSingle();
  if (stagedError) return jsonError(stagedError.message, 500);

  return jsonOk({
    status: (staged?.status ?? "missing") as
      | "pending"
      | "claimed"
      | "deleting"
      | "missing",
  });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const parsed = createUploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Original must be a JPEG, PNG, or WebP image under 50 MB", 400);
  }

  const extension = extensionByType[parsed.data.content_type];
  const path = `${crypto.randomUUID()}.${extension}`;
  const admin = createAdminClient();
  await cleanupExpiredOriginalUploads(admin);

  const { error: insertError } = await admin.from("photo_original_uploads").insert({
    path,
    uploaded_by: user.id,
    content_type: parsed.data.content_type,
    size_bytes: parsed.data.size,
  });
  if (insertError) return jsonError(insertError.message, 500);

  const { data, error } = await admin.storage
    .from(STORAGE_BUCKETS.originals)
    .createSignedUploadUrl(path);

  if (error) {
    await admin.from("photo_original_uploads").delete().eq("path", path);
    return jsonError(error.message, 500);
  }
  return jsonOk({ path, token: data.token });
}

export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const parsed = cleanupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid original path", 400);

  const admin = createAdminClient();
  try {
    const removed = await removePendingOriginalUpload(
      admin,
      parsed.data.path,
      user.id
    );
    return jsonOk({ ok: true, removed });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Original cleanup failed",
      500
    );
  }
}
