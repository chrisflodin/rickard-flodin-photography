export const siteConfig = {
  name: "Rickard Flodin Photography",
  title: "Rickard Flodin Photography",
  description:
    "Photography portfolio of Rickard Flodin. A curated collection of images available to view and order.",
  navigation: [
    { label: "Gallery", href: "/" },
    { label: "About", href: "/about" },
  ],
};

export const STORAGE_BUCKETS = {
  photos: "photos",
  about: "about",
} as const;

// Max length (in px) of the longest edge for stored uploads.
export const MAX_IMAGE_EDGE = 2400;

// Quality used when re-encoding uploads.
export const IMAGE_QUALITY = 82;
