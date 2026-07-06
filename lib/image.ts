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

/**
 * Resize an oversized upload down to a sensible max edge, re-encode as
 * high-quality WebP, and generate a tiny blurred base64 placeholder.
 */
export async function processUpload(input: Buffer): Promise<ProcessedImage> {
  const pipeline = sharp(input, { failOn: "none" }).rotate();
  const metadata = await pipeline.metadata();

  const longestEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  const needsResize = longestEdge > MAX_IMAGE_EDGE;

  const resized = needsResize
    ? pipeline.resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
    : pipeline;

  const { data, info } = await resized
    .webp({ quality: IMAGE_QUALITY })
    .toBuffer({ resolveWithObject: true });

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
    width: info.width,
    height: info.height,
    blurDataUrl,
  };
}
