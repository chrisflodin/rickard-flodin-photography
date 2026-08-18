import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";
import { getPhoto } from "@/lib/server/backend/content";
import { getPublicUrl } from "@/lib/server/backend/storage-url";
import { processStorageDeletionQueue } from "@/lib/server/storage-cleanup";
import type { Photo } from "@/types/photo";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  digital_price: z.number().nonnegative().nullable(),
  print_a3_price: z.number().nonnegative().nullable(),
  print_a2_price: z.number().nonnegative().nullable(),
});

function withImageUrl(photo: Photo, hasOriginal = false): Photo {
  return {
    ...photo,
    has_original: hasOriginal,
    image_url: getPublicUrl(STORAGE_BUCKETS.photos, photo.storage_path),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const photo = await getPhoto(id);

  if (!photo) return jsonError("Photo not found", 404);
  const admin = createAdminClient();
  const { data: original } = await admin
    .from("photo_originals")
    .select("photo_id")
    .eq("photo_id", id)
    .maybeSingle();

  return jsonOk({ photo: withImageUrl(photo, Boolean(original)) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid input", 400);

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("photos")
    .select("category_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await admin
    .from("photos")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      digital_price: parsed.data.digital_price,
      print_a3_price: parsed.data.print_a3_price,
      print_a2_price: parsed.data.print_a2_price,
    })
    .eq("id", id);

  if (error) return jsonError(error.message, 500);

  revalidatePath("/");
  if (existing?.category_id) {
    const { data: category } = await admin
      .from("categories")
      .select("slug")
      .eq("id", existing.category_id)
      .maybeSingle();
    if (category) revalidatePath(`/categories/${category.slug}`);
  }
  revalidatePath(`/photos/${id}`);
  return jsonOk({ ok: true });
}

export async function DELETE(
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
  const { data, error } = await admin.rpc("delete_photo_and_queue_storage", {
    target_photo_id: id,
  });
  if (error) return jsonError(error.message, 500);
  const deleted = (data as { category_id: string }[] | null)?.[0];
  if (!deleted) return jsonError("Photo not found", 404);

  await processStorageDeletionQueue(admin).catch(() => undefined);

  revalidatePath("/");
  if (deleted.category_id) {
    const { data: category } = await admin
      .from("categories")
      .select("slug")
      .eq("id", deleted.category_id)
      .maybeSingle();
    if (category) revalidatePath(`/categories/${category.slug}`);
  }
  return jsonOk({ ok: true });
}
