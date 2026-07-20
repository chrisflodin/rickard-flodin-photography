import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";

const positionsSchema = z.object({
  positions: z
    .array(
      z.object({
        id: z.string().uuid(),
        sort_order: z.number().int().min(0),
      })
    )
    .min(1),
});

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const parsed = positionsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid category order", 400);

  const admin = createAdminClient();
  const { count, error: countError } = await admin
    .from("categories")
    .select("id", { count: "exact", head: true })
    .in(
      "id",
      parsed.data.positions.map((position) => position.id)
    );
  if (countError) return jsonError(countError.message, 500);
  if ((count ?? 0) !== parsed.data.positions.length) {
    return jsonError("Categories could not be found", 400);
  }

  const updates = parsed.data.positions.map((position) =>
    admin
      .from("categories")
      .update({ sort_order: position.sort_order })
      .eq("id", position.id)
  );
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) return jsonError(failed.error.message, 500);

  revalidatePath("/");
  return jsonOk({ ok: true });
}
