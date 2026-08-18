"use client";

import {
  MAX_IMAGE_EDGE,
  MAX_ORIGINAL_UPLOAD_BYTES,
  MAX_WEB_UPLOAD_BYTES,
  ORIGINAL_IMAGE_TYPES,
} from "@/lib/constants";

const WEB_UPLOAD_TARGET_BYTES = MAX_WEB_UPLOAD_BYTES - 256 * 1024;
const WEBP_QUALITIES = [0.94, 0.9, 0.86, 0.82];
const DIMENSION_SCALES = [1, 0.9, 0.8, 0.7];

export interface PreparedWebImage {
  file: File;
  preservePreparedWebp: boolean;
}

function isSupportedOriginalType(type: string) {
  return (ORIGINAL_IMAGE_TYPES as readonly string[]).includes(type);
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp") {
          reject(new Error("This browser could not create a WebP image"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

export function validateOriginal(file: File) {
  if (!isSupportedOriginalType(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image");
  }
  if (file.size <= 0) {
    throw new Error("The selected image is empty");
  }
  if (file.size > MAX_ORIGINAL_UPLOAD_BYTES) {
    throw new Error("The original image must be 50 MB or smaller");
  }
}

export async function prepareWebImage(file: File): Promise<PreparedWebImage> {
  validateOriginal(file);
  if (file.size <= WEB_UPLOAD_TARGET_BYTES) {
    return { file, preservePreparedWebp: false };
  }

  let bitmap: ImageBitmap | null = null;
  const canvas = document.createElement("canvas");

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const baseScale = Math.min(1, MAX_IMAGE_EDGE / longestEdge);
    let smallestBlob: Blob | null = null;

    for (const dimensionScale of DIMENSION_SCALES) {
      canvas.width = Math.max(1, Math.round(bitmap.width * baseScale * dimensionScale));
      canvas.height = Math.max(1, Math.round(bitmap.height * baseScale * dimensionScale));

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare the image for upload");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of WEBP_QUALITIES) {
        const blob = await canvasToWebp(canvas, quality);
        if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
        if (blob.size <= WEB_UPLOAD_TARGET_BYTES) {
          const baseName = file.name.replace(/\.[^/.]+$/, "") || "photo";
          return {
            file: new File([blob], `${baseName}.webp`, {
              type: "image/webp",
              lastModified: file.lastModified,
            }),
            preservePreparedWebp: true,
          };
        }
      }
    }

    if (smallestBlob && smallestBlob.size <= MAX_WEB_UPLOAD_BYTES) {
      const baseName = file.name.replace(/\.[^/.]+$/, "") || "photo";
      return {
        file: new File([smallestBlob], `${baseName}.webp`, {
          type: "image/webp",
          lastModified: file.lastModified,
        }),
        preservePreparedWebp: true,
      };
    }

    throw new Error("The image could not be optimized below the upload limit");
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("The selected image could not be processed");
  } finally {
    bitmap?.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
