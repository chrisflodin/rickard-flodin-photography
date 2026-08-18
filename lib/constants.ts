export const siteConfig = {
  name: "Rickard Flodin Photography",
  title: "Rickard Flodin Photography",
  description:
    "Photography portfolio of Rickard Flodin. A curated collection of images available to view and order.",
  creator: "Rickard Flodin",
  navigation: [
    { label: "About", href: "/about" },
  ],
};

function normalizeUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredUrl) return normalizeUrl(configuredUrl);

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return normalizeUrl(`https://${vercelUrl}`);

  return "http://localhost:3000";
}

export function getCanonicalUrl(path = "/") {
  const pathname = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${pathname}`;
}

export const STORAGE_BUCKETS = {
  photos: "photos",
  originals: "photo-originals",
  about: "about",
  invoices: "invoices",
} as const;

// Max length (in px) of the longest edge for stored uploads.
export const MAX_IMAGE_EDGE = 2400;

// Quality used when re-encoding uploads.
export const IMAGE_QUALITY = 82;

// Keep multipart requests safely below Vercel's 4.5 MB function payload limit.
export const MAX_WEB_UPLOAD_BYTES = 4 * 1024 * 1024;

// Matches the private original bucket limit.
export const MAX_ORIGINAL_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ORIGINAL_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
