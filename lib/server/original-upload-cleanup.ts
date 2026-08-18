import "server-only";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { queueStorageDeletion } from "@/lib/server/storage-cleanup";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function abandonClaimedOriginalUpload(
  admin: AdminClient,
  path: string,
  uploadedBy: string
) {
  const { data, error } = await admin.rpc("abandon_photo_upload", {
    target_upload_path: path,
    target_upload_user_id: uploadedBy,
  });
  if (error) throw error;

  const abandoned = (
    data as { original_path: string; web_path: string | null }[] | null
  )?.[0];
  if (!abandoned) return false;

  if (abandoned.web_path) {
    await queueStorageDeletion(
      admin,
      STORAGE_BUCKETS.photos,
      abandoned.web_path
    );
  }

  const { error: removeError } = await admin.storage
    .from(STORAGE_BUCKETS.originals)
    .remove([abandoned.original_path]);
  if (removeError) throw removeError;

  await admin
    .from("photo_original_uploads")
    .delete()
    .eq("path", abandoned.original_path)
    .eq("status", "deleting");
  return true;
}

export async function removePendingOriginalUpload(
  admin: AdminClient,
  path: string,
  uploadedBy?: string
) {
  const lockQuery = admin
    .from("photo_original_uploads")
    .update({ status: "deleting" })
    .eq("path", path)
    .eq("status", "pending");
  const { data: locked, error: lockError } = await (
    uploadedBy ? lockQuery.eq("uploaded_by", uploadedBy) : lockQuery
  )
    .select("path")
    .maybeSingle();

  if (lockError) throw lockError;
  if (!locked) return false;

  const { error: removeError } = await admin.storage
    .from(STORAGE_BUCKETS.originals)
    .remove([path]);
  if (removeError) {
    await admin
      .from("photo_original_uploads")
      .update({ status: "pending" })
      .eq("path", path)
      .eq("status", "deleting");
    throw removeError;
  }

  await admin
    .from("photo_original_uploads")
    .delete()
    .eq("path", path)
    .eq("status", "deleting");
  return true;
}

export async function cleanupExpiredOriginalUploads(
  admin: AdminClient = createAdminClient()
) {
  const pendingCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const claimedCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [
    { data: pending, error: pendingError },
    { data: claimed, error: claimedError },
    { data: deleting, error: deletingError },
  ] = await Promise.all([
    admin
      .from("photo_original_uploads")
      .select("path, web_storage_path")
      .eq("status", "pending")
      .lt("created_at", pendingCutoff)
      .limit(50),
    admin
      .from("photo_original_uploads")
      .select("path, web_storage_path")
      .eq("status", "claimed")
      .lt("claimed_at", claimedCutoff)
      .limit(50),
    admin
      .from("photo_original_uploads")
      .select("path, web_storage_path")
      .eq("status", "deleting")
      .lt("created_at", pendingCutoff)
      .limit(50),
  ]);
  if (pendingError) throw pendingError;
  if (claimedError) throw claimedError;
  if (deletingError) throw deletingError;

  let removed = 0;
  for (const upload of pending ?? []) {
    if (
      await removePendingOriginalUpload(admin, upload.path).catch(() => false)
    ) {
      removed += 1;
    }
  }

  for (const upload of claimed ?? []) {
    const [
      { count: photoReferences, error: photoReferenceError },
      { count: orderReferences, error: orderReferenceError },
    ] = await Promise.all([
      admin
        .from("photo_originals")
        .select("photo_id", { count: "exact", head: true })
        .eq("storage_path", upload.path),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("original_storage_path", upload.path),
    ]);
    if (photoReferenceError || orderReferenceError) continue;

    if ((photoReferences ?? 0) > 0 || (orderReferences ?? 0) > 0) {
      await admin.from("photo_original_uploads").delete().eq("path", upload.path);
      continue;
    }

    const { data: locked, error: lockError } = await admin
      .from("photo_original_uploads")
      .update({ status: "deleting" })
      .eq("path", upload.path)
      .eq("status", "claimed")
      .select("path")
      .maybeSingle();
    if (lockError || !locked) continue;

    const { error: removeError } = await admin.storage
      .from(STORAGE_BUCKETS.originals)
      .remove([upload.path]);
    if (removeError) {
      await admin
        .from("photo_original_uploads")
        .update({ status: "claimed" })
        .eq("path", upload.path)
        .eq("status", "deleting");
    } else {
      if (upload.web_storage_path) {
        try {
          await queueStorageDeletion(
            admin,
            STORAGE_BUCKETS.photos,
            upload.web_storage_path
          );
        } catch {
          await admin
            .from("photo_original_uploads")
            .update({ status: "claimed" })
            .eq("path", upload.path)
            .eq("status", "deleting");
          continue;
        }
      }
      await admin.from("photo_original_uploads").delete().eq("path", upload.path);
      removed += 1;
    }
  }

  for (const upload of deleting ?? []) {
    const { error: removeError } = await admin.storage
      .from(STORAGE_BUCKETS.originals)
      .remove([upload.path]);
    if (removeError) continue;

    if (upload.web_storage_path) {
      try {
        await queueStorageDeletion(
          admin,
          STORAGE_BUCKETS.photos,
          upload.web_storage_path
        );
      } catch {
        continue;
      }
    }
    await admin.from("photo_original_uploads").delete().eq("path", upload.path);
    removed += 1;
  }

  return {
    examined:
      (pending?.length ?? 0) +
      (claimed?.length ?? 0) +
      (deleting?.length ?? 0),
    removed,
  };
}
