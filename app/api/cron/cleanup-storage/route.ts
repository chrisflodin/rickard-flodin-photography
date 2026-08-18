import { jsonError, jsonOk } from "@/lib/api-response";
import { cleanupExpiredOriginalUploads } from "@/lib/server/original-upload-cleanup";
import { processStorageDeletionQueue } from "@/lib/server/storage-cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const originalUploads = await cleanupExpiredOriginalUploads();
    const storageDeletions = await processStorageDeletionQueue();
    return jsonOk({
      original_uploads: originalUploads,
      storage_deletions: storageDeletions,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Storage cleanup failed",
      500
    );
  }
}
