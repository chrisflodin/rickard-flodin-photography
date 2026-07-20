import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";
import {
  getCategoryBySlug,
  getGallerySettings,
  getPhotos,
  getPhotosByCategory,
} from "@/lib/server/backend/content";
import { getPublicUrl } from "@/lib/server/backend/storage-url";
import { processUpload } from "@/lib/image";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { GallerySettings, Photo } from "@/types/photo";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB source cap

function withImageUrl(photo: Photo): Photo {
  return {
    ...photo,
    image_url: getPublicUrl(STORAGE_BUCKETS.photos, photo.storage_path),
  };
}

export async function GET(request: Request) {
  const categorySlug = new URL(request.url).searchParams.get("category");
  const category = categorySlug ? await getCategoryBySlug(categorySlug) : null;
  if (categorySlug && !category) return jsonError("Category not found", 404);

  const [photos, settings] = await Promise.all([
    category ? getPhotosByCategory(category.id) : getPhotos(),
    getGallerySettings(),
  ]);

  return jsonOk<{ photos: Photo[]; settings: GallerySettings }>({
    photos: photos.map(withImageUrl),
    settings,
  });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const priceValue = (formData.get("price") as string | null)?.trim();
  const categoryId = formData.get("category_id") as string | null;

  if (!(file instanceof File)) {
    return jsonError("No file provided", 400);
  }
  if (!title || title.length > 200) {
    return jsonError("Title must be between 1 and 200 characters", 400);
  }
  if (description.length > 5000) {
    return jsonError("Description must be at most 5000 characters", 400);
  }
  if (!categoryId) {
    return jsonError("A category is required", 400);
  }
  const price = Number(priceValue);
  if (!priceValue || !Number.isFinite(price) || price < 0) {
    return jsonError("Price must be a non-negative number", 400);
  }
  if (!file.type.startsWith("image/")) {
    return jsonError("File must be an image", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError("Image is too large (max 25 MB)", 400);
  }

  const admin = createAdminClient();

  try {
    const { data: category, error: categoryError } = await admin
      .from("categories")
      .select("id, slug")
      .eq("id", categoryId)
      .maybeSingle();
    if (categoryError) return jsonError(categoryError.message, 500);
    if (!category) return jsonError("Category not found", 400);

    const input = Buffer.from(await file.arrayBuffer());
    const processed = await processUpload(input);

    const path = `${crypto.randomUUID()}.${processed.extension}`;

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKETS.photos)
      .upload(path, processed.buffer, {
        contentType: processed.contentType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      return jsonError(uploadError.message, 500);
    }

    // Determine placement: append the new photo to the shortest column so
    // uploads don't disturb the existing composed layout.
    const { data: settings } = await admin
      .from("gallery_settings")
      .select("columns_count")
      .eq("id", true)
      .maybeSingle();

    const columnsCount = Math.max(1, settings?.columns_count ?? 3);

    const { data: existing } = await admin
      .from("photos")
      .select("column_index, column_order")
      .eq("category_id", categoryId);

    const counts = new Array(columnsCount).fill(0);
    const maxOrderInColumn = new Array(columnsCount).fill(-1);
    for (const row of existing ?? []) {
      const col = row.column_index as number;
      if (col >= 0 && col < columnsCount) {
        counts[col] += 1;
        maxOrderInColumn[col] = Math.max(
          maxOrderInColumn[col],
          row.column_order as number
        );
      }
    }

    // Shortest column (ties resolved by lowest index for a stable left-first fill).
    let targetColumn = 0;
    for (let i = 1; i < columnsCount; i++) {
      if (counts[i] < counts[targetColumn]) targetColumn = i;
    }
    const targetOrder = maxOrderInColumn[targetColumn] + 1;

    const { data, error: insertError } = await admin
      .from("photos")
      .insert({
        title,
        description,
        price,
        category_id: categoryId,
        storage_path: path,
        width: processed.width,
        height: processed.height,
        blur_data_url: processed.blurDataUrl,
        column_index: targetColumn,
        column_order: targetOrder,
      })
      .select("*")
      .single();

    if (insertError) {
      // Roll back the uploaded object on DB failure.
      await admin.storage.from(STORAGE_BUCKETS.photos).remove([path]);
      return jsonError(insertError.message, 500);
    }

    revalidatePath("/");
    revalidatePath(`/categories/${category.slug}`);
    return jsonOk({ photo: withImageUrl(data as Photo) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return jsonError(message, 500);
  }
}
