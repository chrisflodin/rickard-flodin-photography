"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/services/supabase/auth";
import { createAdminClient } from "@/services/supabase/admin";
import type { ActionResult } from "@/app/actions/photos";

const bodySchema = z.string().max(20000);

export async function updateAbout(body: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("about")
    .update({ body: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/about");
  return { ok: true };
}
