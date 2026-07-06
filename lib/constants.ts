export const siteConfig = {
  name: "Rickard Flodin Photography",
  title: "Rickard Flodin Photography",
  description:
    "Photography portfolio of Rickard Flodin. A curated collection of images available to view and order.",
  creator: "Rickard Flodin",
  navigation: [
    { label: "Gallery", href: "/" },
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
  about: "about",
} as const;

// Max length (in px) of the longest edge for stored uploads.
export const MAX_IMAGE_EDGE = 2400;

// Quality used when re-encoding uploads.
export const IMAGE_QUALITY = 82;
