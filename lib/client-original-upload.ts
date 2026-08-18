"use client";

import * as tus from "tus-js-client";
import { readJsonResult } from "@/lib/api-response";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { validateOriginal } from "@/lib/client-image";

const TUS_CHUNK_BYTES = 6 * 1024 * 1024;

interface OriginalUploadTicket {
  path: string;
  token: string;
}

export interface OriginalUploadStatus {
  status: "pending" | "claimed" | "deleting" | "finalized" | "missing";
  photo_id?: string;
}

function getResumableUploadEndpoint() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) throw new Error("Supabase is not configured");

  const url = new URL(configuredUrl);
  if (url.hostname.endsWith(".supabase.co")) {
    const projectRef = url.hostname.slice(0, -".supabase.co".length);
    return `${url.protocol}//${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  }
  return `${url.origin}/storage/v1/upload/resumable`;
}

async function createOriginalUploadTicket(file: File) {
  const response = await fetch("/api/photos/original-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: file.type, size: file.size }),
  });
  const result = await readJsonResult<OriginalUploadTicket>(response);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export async function uploadOriginal(
  file: File,
  onProgress?: (percent: number) => void
) {
  validateOriginal(file);
  const ticket = await createOriginalUploadTicket(file);
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error("Supabase is not configured");

  try {
    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: getResumableUploadEndpoint(),
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          apikey: publishableKey,
          "x-signature": ticket.token,
        },
        chunkSize: TUS_CHUNK_BYTES,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: STORAGE_BUCKETS.originals,
          objectName: ticket.path,
          contentType: file.type,
          cacheControl: "3600",
        },
        onError(error) {
          reject(error);
        },
        onProgress(bytesUploaded, bytesTotal) {
          onProgress?.(
            bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0
          );
        },
        onSuccess() {
          resolve();
        },
      });

      upload.start();
    });
    return ticket.path;
  } catch (error) {
    await cleanupOriginal(ticket.path);
    throw error instanceof Error ? error : new Error("Original upload failed");
  }
}

export async function cleanupOriginal(path: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("/api/photos/original-upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (response.ok) return;
    } catch {
      // Retry once; expired staged uploads are also cleaned server-side later.
    }

    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }
}

export async function getOriginalUploadStatus(path: string) {
  const response = await fetch(
    `/api/photos/original-upload?path=${encodeURIComponent(path)}`,
    { cache: "no-store" }
  );
  const result = await readJsonResult<OriginalUploadStatus>(response);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
