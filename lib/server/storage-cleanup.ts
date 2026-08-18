import "server-only";
import { createAdminClient } from "@/lib/server/backend/admin-client";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function queueStorageDeletion(
  admin: AdminClient,
  bucketId: string,
  objectPath: string
) {
  const { error } = await admin.from("storage_deletion_queue").upsert(
    {
      bucket_id: bucketId,
      object_path: objectPath,
      attempts: 0,
      last_error: null,
    },
    { onConflict: "bucket_id,object_path", ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function processStorageDeletionQueue(
  admin: AdminClient = createAdminClient(),
  limit = 50
) {
  const { data: queued, error } = await admin
    .from("storage_deletion_queue")
    .select("id, bucket_id, object_path, attempts")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  let removed = 0;
  for (const item of queued ?? []) {
    const { error: removeError } = await admin.storage
      .from(item.bucket_id)
      .remove([item.object_path]);

    if (removeError) {
      await admin
        .from("storage_deletion_queue")
        .update({
          attempts: item.attempts + 1,
          last_error: removeError.message.slice(0, 500),
        })
        .eq("id", item.id);
      continue;
    }

    await admin.from("storage_deletion_queue").delete().eq("id", item.id);
    removed += 1;
  }

  return { processed: queued?.length ?? 0, removed };
}
