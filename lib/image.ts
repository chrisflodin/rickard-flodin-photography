import "server-only";
import sharp from "sharp";
import { IMAGE_QUALITY, MAX_IMAGE_EDGE } from "@/lib/constants";

export interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  blurDataUrl: string;
}

interface ProcessUploadOptions {
  preservePreparedWebp?: boolean;
}

/**
 * Normalize uploads to a sensible max edge and high-quality WebP, then create
 * a tiny blur placeholder. Browser-prepared WebP copies are validated and kept
 * byte-for-byte to avoid a second lossy encode.
 */
export async function processUpload(
  input: Buffer,
  options: ProcessUploadOptions = {}
): Promise<ProcessedImage> {
  const source = sharp(input, {
    failOn: options.preservePreparedWebp ? "error" : "none",
  });
  const metadata = await source.metadata();

  const longestEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  let data: Buffer;
  let width: number;
  let height: number;

  if (options.preservePreparedWebp) {
    if (
      metadata.format !== "webp" ||
      !metadata.width ||
      !metadata.height ||
      longestEdge > MAX_IMAGE_EDGE ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new Error("Prepared web image is invalid");
    }
    data = input;
    width = metadata.width;
    height = metadata.height;
  } else {
    const pipeline = source.rotate();
    const needsResize = longestEdge > MAX_IMAGE_EDGE;
    const resized = needsResize
      ? pipeline.resize({
          width: MAX_IMAGE_EDGE,
          height: MAX_IMAGE_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
      : pipeline;

    const encoded = await resized
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer({ resolveWithObject: true });
    data = encoded.data;
    width = encoded.info.width;
    height = encoded.info.height;
  }

  const blurBuffer = await sharp(input, { failOn: "none" })
    .rotate()
    .resize(16, 16, { fit: "inside" })
    .webp({ quality: 40 })
    .toBuffer();

  const blurDataUrl = `data:image/webp;base64,${blurBuffer.toString("base64")}`;

  return {
    buffer: data,
    contentType: "image/webp",
    extension: "webp",
    width,
    height,
    blurDataUrl,
  };
}
