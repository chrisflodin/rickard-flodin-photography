import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin } from "@/services/supabase/auth";

const settingsSchema = z.object({
  columns_count: z.number().int().min(1).max(6),
});

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid column count", 400);

  const admin = createAdminClient();
  const { error } = await admin
    .from("gallery_settings")
    .update({
      columns_count: parsed.data.columns_count,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) return jsonError(error.message, 500);

  revalidatePath("/");
  return jsonOk({ ok: true });
}
