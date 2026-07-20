import type { MetadataRoute } from "next";
import { getCanonicalUrl } from "@/lib/constants";
import { getCategories, getPhotos } from "@/lib/server/backend/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [photos, categories] = await Promise.all([getPhotos(), getCategories()]);

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
    ...categories.map((category) => ({
      url: getCanonicalUrl(`/categories/${category.slug}`),
      lastModified: new Date(category.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...photos.map((photo) => ({
      url: getCanonicalUrl(`/photos/${photo.id}`),
      lastModified: new Date(photo.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}

