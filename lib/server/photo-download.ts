import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const DIGITAL_DOWNLOAD_VALIDITY_DAYS = 7;

export function createDigitalDownloadToken() {
  return randomBytes(32).toString("base64url");
}

export function hashDigitalDownloadToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function digitalDownloadExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DIGITAL_DOWNLOAD_VALIDITY_DAYS);
  return expiresAt.toISOString();
}

export function photoDownloadName(title: string, path: string) {
  const safeTitle =
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "photo";
  const extension = path.split(".").pop()?.toLowerCase() || "jpg";
  return `${safeTitle}.${extension}`;
}
