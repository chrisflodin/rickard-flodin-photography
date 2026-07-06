import type { MetadataRoute } from "next";
import { getCanonicalUrl } from "@/lib/constants";
import { getPhotos } from "@/services/supabase/photos";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const photos = await getPhotos();

  return [
    {
      url: getCanonicalUrl("/"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getCanonicalUrl("/about"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...photos.map((photo) => ({
      url: getCanonicalUrl(`/photos/${photo.id}`),
      lastModified: new Date(photo.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}

