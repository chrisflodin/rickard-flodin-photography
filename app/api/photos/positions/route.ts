import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";

const positionsSchema = z.object({
  category_id: z.string().uuid(),
  positions: z.array(
    z.object({
      id: z.string().uuid(),
      column_index: z.number().int().min(-1).max(5),
      column_order: z.number().int().min(0),
    })
  ),
});

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const parsed = positionsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid layout", 400);

  const admin = createAdminClient();
  const { data: category, error: categoryError } = await admin
    .from("categories")
    .select("slug")
    .eq("id", parsed.data.category_id)
    .maybeSingle();
  if (categoryError) return jsonError(categoryError.message, 500);
  if (!category) return jsonError("Category not found", 404);

  const ids = parsed.data.positions.map((position) => position.id);
  const { count, error: countError } = await admin
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("category_id", parsed.data.category_id)
    .in("id", ids);
  if (countError) return jsonError(countError.message, 500);
  if ((count ?? 0) !== ids.length) {
    return jsonError("Photos must belong to the selected category", 400);
  }

  const updates = parsed.data.positions.map((position) =>
    admin
      .from("photos")
      .update({
        column_index: position.column_index,
        column_order: position.column_order,
      })
      .eq("id", position.id)
      .eq("category_id", parsed.data.category_id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) return jsonError(failed.error.message, 500);

  revalidatePath("/");
  revalidatePath(`/categories/${category.slug}`);
  return jsonOk({ ok: true });
}
