"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/services/supabase/auth";
import { createAdminClient } from "@/services/supabase/admin";
import { STORAGE_BUCKETS } from "@/lib/constants";

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  price: z.number().nonnegative().nullable(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updatePhoto(input: {
  id: string;
  title: string;
  description: string;
  price: number | null;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("photos")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
    })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath(`/photos/${parsed.data.id}`);
  return { ok: true };
}

export async function deletePhoto(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const admin = createAdminClient();

  const { data: photo } = await admin
    .from("photos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("photos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (photo?.storage_path) {
    await admin.storage
      .from(STORAGE_BUCKETS.photos)
      .remove([photo.storage_path as string]);
  }

  revalidatePath("/");
  return { ok: true };
}

const positionsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    column_index: z.number().int().min(-1).max(5),
    column_order: z.number().int().min(0),
  })
);

/**
 * Persist the full column layout after a drag or a column-count change.
 * Only the columns that actually changed will differ, but sending the whole
 * snapshot keeps the client and database perfectly in sync.
 */
export async function updatePhotoPositions(
  positions: {
    id: string;
    column_index: number;
    column_order: number;
  }[]
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = positionsSchema.safeParse(positions);
  if (!parsed.success) return { ok: false, error: "Invalid layout" };

  const admin = createAdminClient();

  const updates = parsed.data.map((p) =>
    admin
      .from("photos")
      .update({ column_index: p.column_index, column_order: p.column_order })
      .eq("id", p.id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  revalidatePath("/");
  return { ok: true };
}

/**
 * Persist the number of gallery columns. Redistribution of photos into the new
 * column count is performed on the client and saved via updatePhotoPositions.
 */
export async function setColumnsCount(count: number): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = z.number().int().min(1).max(6).safeParse(count);
  if (!parsed.success) return { ok: false, error: "Invalid column count" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("gallery_settings")
    .update({ columns_count: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}
