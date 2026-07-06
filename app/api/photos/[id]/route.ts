import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin } from "@/services/supabase/auth";
import { getPhoto } from "@/services/supabase/photos";
import { getPublicUrl } from "@/services/supabase/storage";
import type { Photo } from "@/types/photo";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  price: z.number().nonnegative().nullable(),
});

function withImageUrl(photo: Photo): Photo {
  return {
    ...photo,
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

  return jsonOk({ photo: withImageUrl(photo) });
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
  const { error } = await admin
    .from("photos")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
    })
    .eq("id", id);

  if (error) return jsonError(error.message, 500);

  revalidatePath("/");
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

  const { data: photo } = await admin
    .from("photos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("photos").delete().eq("id", id);
  if (error) return jsonError(error.message, 500);

  if (photo?.storage_path) {
    await admin.storage
      .from(STORAGE_BUCKETS.photos)
      .remove([photo.storage_path as string]);
  }

  revalidatePath("/");
  return jsonOk({ ok: true });
}
