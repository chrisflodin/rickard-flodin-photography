import { NextResponse } from "next/server";
import { requireAdmin } from "@/services/supabase/auth";
import { createAdminClient } from "@/services/supabase/admin";
import { processUpload } from "@/lib/image";
import { STORAGE_BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

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
    const path = `photographer-${crypto.randomUUID()}.${processed.extension}`;

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKETS.about)
      .upload(path, processed.buffer, {
        contentType: processed.contentType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Remove the previous image (if any) and store the new path.
    const { data: current } = await admin
      .from("about")
      .select("photographer_image_path")
      .eq("id", true)
      .maybeSingle();

    const previous = current?.photographer_image_path as string | null;

    const { error: updateError } = await admin
      .from("about")
      .update({
        photographer_image_path: path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);

    if (updateError) {
      await admin.storage.from(STORAGE_BUCKETS.about).remove([path]);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (previous && previous !== path) {
      await admin.storage.from(STORAGE_BUCKETS.about).remove([previous]);
    }

    return NextResponse.json({ path }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
