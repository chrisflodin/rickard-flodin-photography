import { NextResponse } from "next/server";
import { requireAdmin } from "@/services/supabase/auth";
import { createAdminClient } from "@/services/supabase/admin";
import { processUpload } from "@/lib/image";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { Photo } from "@/types/photo";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB source cap

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "File must be an image" },
      { status: 400 }
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image is too large (max 25 MB)" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  try {
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
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
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
      .select("column_index, column_order");

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

    const title = (formData.get("title") as string) || "Untitled";

    const { data, error: insertError } = await admin
      .from("photos")
      .insert({
        title,
        description: "",
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
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ photo: data as Photo }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
