import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";

const updateCategorySchema = z.object({
  featured_photo_id: z.string().uuid().nullable(),
});

async function getCategory(
  id: string,
  admin: ReturnType<typeof createAdminClient>
) {
  return admin.from("categories").select("id, slug").eq("id", id).maybeSingle();
}

function revalidateCategory(slug: string) {
  revalidatePath("/");
  revalidatePath(`/categories/${slug}`);
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
  const parsed = updateCategorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid category update", 400);

  const admin = createAdminClient();
  const { data: category, error: categoryError } = await getCategory(id, admin);
  if (categoryError) return jsonError(categoryError.message, 500);
  if (!category) return jsonError("Category not found", 404);

  if (parsed.data.featured_photo_id) {
    const { data: photo, error: photoError } = await admin
      .from("photos")
      .select("id")
      .eq("id", parsed.data.featured_photo_id)
      .eq("category_id", id)
      .maybeSingle();
    if (photoError) return jsonError(photoError.message, 500);
    if (!photo) return jsonError("Featured photo must belong to this category", 400);
  }

  const { error } = await admin
    .from("categories")
    .update({ featured_photo_id: parsed.data.featured_photo_id })
    .eq("id", id);
  if (error) return jsonError(error.message, 500);

  revalidateCategory(category.slug);
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
  const { data: category, error: categoryError } = await getCategory(id, admin);
  if (categoryError) return jsonError(categoryError.message, 500);
  if (!category) return jsonError("Category not found", 404);

  const { count, error: countError } = await admin
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if (countError) return jsonError(countError.message, 500);
  if ((count ?? 0) > 0) {
    return jsonError("Move or delete this category's photos before deleting it", 409);
  }

  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) return jsonError(error.message, 500);

  revalidateCategory(category.slug);
  return jsonOk({ ok: true });
}
