import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin } from "@/services/supabase/auth";

const positionsSchema = z.object({
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
  const updates = parsed.data.positions.map((position) =>
    admin
      .from("photos")
      .update({
        column_index: position.column_index,
        column_order: position.column_order,
      })
      .eq("id", position.id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) return jsonError(failed.error.message, 500);

  revalidatePath("/");
  return jsonOk({ ok: true });
}
