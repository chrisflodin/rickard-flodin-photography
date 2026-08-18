import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
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
import { abandonClaimedOriginalUpload } from "@/lib/server/original-upload-cleanup";
import { processStorageDeletionQueue } from "@/lib/server/storage-cleanup";
import {
  MAX_ORIGINAL_UPLOAD_BYTES,
  MAX_WEB_UPLOAD_BYTES,
  ORIGINAL_IMAGE_TYPES,
  STORAGE_BUCKETS,
} from "@/lib/constants";
import type { GallerySettings, Photo } from "@/types/photo";

export const runtime = "nodejs";
export const maxDuration = 60;

const originalPathPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

function withImageUrl(photo: Photo, hasOriginal = false): Photo {
  return {
    ...photo,
    has_original: hasOriginal,
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
  const admin = createAdminClient();
  const { data: originalRows } =
    photos.length > 0
      ? await admin
          .from("photo_originals")
          .select("photo_id")
          .in(
            "photo_id",
            photos.map((photo) => photo.id)
          )
      : { data: [] as { photo_id: string }[] };
  const originalPhotoIds = new Set(
    (originalRows ?? []).map((row) => row.photo_id as string)
  );

  return jsonOk<{ photos: Photo[]; settings: GallerySettings }>({
    photos: photos.map((photo) =>
      withImageUrl(photo, originalPhotoIds.has(photo.id))
    ),
    settings,
  });
}

export async function POST(request: Request) {
  let adminUser: User;
  try {
    adminUser = await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const digitalPriceValue = (formData.get("digital_price") as string | null)?.trim();
  const printA3PriceValue = (formData.get("print_a3_price") as string | null)?.trim();
  const printA2PriceValue = (formData.get("print_a2_price") as string | null)?.trim();
  const categoryId = formData.get("category_id") as string | null;
  const originalStoragePathValue = formData.get("original_storage_path") as
    | string
    | null;
  const preservePreparedWebp =
    formData.get("preserve_prepared_webp") === "true";

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
  if (
    !originalStoragePathValue ||
    !originalPathPattern.test(originalStoragePathValue)
  ) {
    return jsonError("A valid original image upload is required", 400);
  }
  const originalStoragePath = originalStoragePathValue;
  const digitalPrice = Number(digitalPriceValue);
  const printA3Price = Number(printA3PriceValue);
  const printA2Price = Number(printA2PriceValue);
  if (
    !digitalPriceValue ||
    !printA3PriceValue ||
    !printA2PriceValue ||
    !Number.isFinite(digitalPrice) ||
    !Number.isFinite(printA3Price) ||
    !Number.isFinite(printA2Price) ||
    digitalPrice < 0 ||
    printA3Price < 0 ||
    printA2Price < 0
  ) {
    return jsonError("All prices must be non-negative numbers", 400);
  }
  if (!(ORIGINAL_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return jsonError("Web copy must be a JPEG, PNG, or WebP image", 400);
  }
  if (file.size > MAX_WEB_UPLOAD_BYTES) {
    return jsonError("Web copy is too large after optimization (max 4 MB)", 400);
  }

  const admin = createAdminClient();
  let persisted = false;
  let originalClaimed = false;

  async function removeClaimedOriginal() {
    const abandoned = await abandonClaimedOriginalUpload(
      admin,
      originalStoragePath,
      adminUser.id
    ).catch(() => false);
    if (abandoned) {
      await processStorageDeletionQueue(admin, 10).catch(() => undefined);
    }
    originalClaimed = false;
    return abandoned;
  }

  try {
    const { data: existingOriginal, error: existingOriginalError } = await admin
      .from("photo_originals")
      .select("photo_id")
      .eq("storage_path", originalStoragePath)
      .maybeSingle();
    if (existingOriginalError) return jsonError(existingOriginalError.message, 500);
    if (existingOriginal) {
      const { data: existingPhoto, error: existingPhotoError } = await admin
        .from("photos")
        .select("*")
        .eq("id", existingOriginal.photo_id)
        .maybeSingle();
      if (existingPhotoError) return jsonError(existingPhotoError.message, 500);
      if (existingPhoto) {
        return jsonOk({ photo: withImageUrl(existingPhoto as Photo, true) });
      }
    }

    const { data: category, error: categoryError } = await admin
      .from("categories")
      .select("id, slug")
      .eq("id", categoryId)
      .maybeSingle();
    if (categoryError) return jsonError(categoryError.message, 500);
    if (!category) return jsonError("Category not found", 400);

    const proposedWebPath = `${crypto.randomUUID()}.webp`;
    const { data: newlyClaimedUpload, error: claimError } = await admin
      .from("photo_original_uploads")
      .update({
        status: "claimed",
        claimed_at: new Date().toISOString(),
        web_storage_path: proposedWebPath,
      })
      .eq("path", originalStoragePath)
      .eq("uploaded_by", adminUser.id)
      .eq("status", "pending")
      .select("path, content_type, size_bytes, web_storage_path")
      .maybeSingle();
    if (claimError) return jsonError(claimError.message, 500);
    let claimedUpload = newlyClaimedUpload;
    if (!claimedUpload) {
      const { data: resumedUpload, error: resumeError } = await admin
        .from("photo_original_uploads")
        .select("path, content_type, size_bytes, web_storage_path")
        .eq("path", originalStoragePath)
        .eq("uploaded_by", adminUser.id)
        .eq("status", "claimed")
        .maybeSingle();
      if (resumeError) return jsonError(resumeError.message, 500);
      claimedUpload = resumedUpload;
    }
    if (!claimedUpload?.web_storage_path) {
      return jsonError("Original upload has expired or was already used", 409);
    }
    originalClaimed = true;
    const claimedWebPath = claimedUpload.web_storage_path;

    const { data: originalObjects, error: originalError } = await admin.storage
      .from(STORAGE_BUCKETS.originals)
      .list("", { limit: 10, search: originalStoragePath });
    if (originalError) {
      await removeClaimedOriginal();
      return jsonError(originalError.message, 500);
    }

    const originalObject = originalObjects?.find(
      (object) => object.name === originalStoragePath
    );
    const originalMetadata = originalObject?.metadata as
      | { size?: number; mimetype?: string }
      | null
      | undefined;
    if (!originalObject || !originalMetadata?.size) {
      await removeClaimedOriginal();
      return jsonError("Original image upload could not be verified", 400);
    }
    if (
      originalMetadata.size !== Number(claimedUpload.size_bytes) ||
      originalMetadata.size > MAX_ORIGINAL_UPLOAD_BYTES ||
      (originalMetadata.mimetype &&
        originalMetadata.mimetype !== claimedUpload.content_type)
    ) {
      await removeClaimedOriginal();
      return jsonError("Original image is invalid", 400);
    }

    const input = Buffer.from(await file.arrayBuffer());
    const processed = await processUpload(input, { preservePreparedWebp });

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKETS.photos)
      .upload(claimedWebPath, processed.buffer, {
        contentType: processed.contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      await removeClaimedOriginal();
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

    const { data: finalizedRows, error: finalizeError } = await admin.rpc(
      "finalize_photo_upload",
      {
        target_upload_path: originalStoragePath,
        target_upload_user_id: adminUser.id,
        target_web_storage_path: claimedWebPath,
        photo_title: title,
        photo_description: description,
        photo_digital_price: digitalPrice,
        photo_print_a3_price: printA3Price,
        photo_print_a2_price: printA2Price,
        photo_category_id: categoryId,
        photo_width: processed.width,
        photo_height: processed.height,
        photo_blur_data_url: processed.blurDataUrl,
        photo_column_index: targetColumn,
        photo_column_order: targetOrder,
      }
    );
    let finalizedPhoto = (finalizedRows as Photo[] | null)?.[0] ?? null;

    if (finalizeError || !finalizedPhoto) {
      const {
        data: committedOriginal,
        error: committedOriginalError,
      } = await admin
        .from("photo_originals")
        .select("photo_id")
        .eq("storage_path", originalStoragePath)
        .maybeSingle();
      if (committedOriginalError) {
        return jsonError(
          finalizeError?.message || committedOriginalError.message,
          500
        );
      }
      if (committedOriginal) {
        const { data: committedPhoto, error: committedPhotoError } = await admin
          .from("photos")
          .select("*")
          .eq("id", committedOriginal.photo_id)
          .maybeSingle();
        if (committedPhotoError) {
          return jsonError(
            finalizeError?.message || committedPhotoError.message,
            500
          );
        }
        finalizedPhoto = (committedPhoto as Photo | null) ?? null;
      }
    }

    if (!finalizedPhoto) {
      await removeClaimedOriginal();
      return jsonError(finalizeError?.message || "Photo finalization failed", 500);
    }

    persisted = true;
    originalClaimed = false;
    revalidatePath("/");
    revalidatePath(`/categories/${category.slug}`);
    return jsonOk(
      { photo: withImageUrl(finalizedPhoto, true) },
      { status: 201 }
    );
  } catch (err) {
    if (!persisted) {
      if (originalClaimed) await removeClaimedOriginal();
    }
    const message = err instanceof Error ? err.message : "Upload failed";
    return jsonError(message, 500);
  }
}
