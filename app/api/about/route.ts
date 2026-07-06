import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";
import { getAbout } from "@/lib/server/backend/content";
import { getPublicUrl } from "@/lib/server/backend/storage-url";
import { processUpload } from "@/lib/image";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { About } from "@/types/photo";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const bodySchema = z.object({
  body: z.string().max(20000),
});

function withPhotographerImageUrl(about: About | null): About | null {
  if (!about) return null;

  return {
    ...about,
    photographer_image_url: about.photographer_image_path
      ? getPublicUrl(STORAGE_BUCKETS.about, about.photographer_image_path)
      : null,
  };
}

export async function GET() {
  const about = await getAbout();
  return jsonOk({ about: withPhotographerImageUrl(about) });
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid input", 400);

  const admin = createAdminClient();
  const { error } = await admin
    .from("about")
    .update({ body: parsed.data.body, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) return jsonError(error.message, 500);

  revalidatePath("/about");
  return jsonOk({ ok: true });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("No file provided", 400);
  }
  if (!file.type.startsWith("image/")) {
    return jsonError("File must be an image", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError("Image is too large (max 25 MB)", 400);
  }

  const admin = createAdminClient();

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const processed = await processUpload(input);
    const path = `photographer-${crypto.randomUUID()}.${processed.extension}`;

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKETS.about)
      .upload(path, processed.buffer, {
        contentType: processed.contentType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      return jsonError(uploadError.message, 500);
    }

    // Remove the previous image (if any) and store the new path.
    const { data: current } = await admin
      .from("about")
      .select("photographer_image_path")
      .eq("id", true)
      .maybeSingle();

    const previous = current?.photographer_image_path as string | null;

    const { error: updateError } = await admin
      .from("about")
      .update({
        photographer_image_path: path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);

    if (updateError) {
      await admin.storage.from(STORAGE_BUCKETS.about).remove([path]);
      return jsonError(updateError.message, 500);
    }

    if (previous && previous !== path) {
      await admin.storage.from(STORAGE_BUCKETS.about).remove([previous]);
    }

    revalidatePath("/about");
    return jsonOk({
      path,
      url: getPublicUrl(STORAGE_BUCKETS.about, path),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return jsonError(message, 500);
  }
}
