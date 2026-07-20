import "server-only";
import { readJsonResult } from "@/lib/api-response";
import { serverApiFetch } from "@/lib/api-client/server";
import type { About, Category, GallerySettings, Photo } from "@/types/photo";

export interface GalleryData {
  photos: Photo[];
  settings: GallerySettings;
}

export async function getGalleryData(): Promise<GalleryData> {
  const response = await serverApiFetch("/api/photos");
  const result = await readJsonResult<GalleryData>(response);

  if (!result.ok) {
    return { photos: [], settings: { columns_count: 3 } };
  }

  return result.data;
}

export async function getCategoryGalleryData(slug: string): Promise<GalleryData | null> {
  const response = await serverApiFetch(
    `/api/photos?category=${encodeURIComponent(slug)}`
  );
  if (response.status === 404) return null;

  const result = await readJsonResult<GalleryData>(response);
  return result.ok ? result.data : null;
}

export async function getCategories(): Promise<Category[]> {
  const response = await serverApiFetch("/api/categories");
  const result = await readJsonResult<{ categories: Category[] }>(response);
  return result.ok ? result.data.categories : [];
}

export async function getPhoto(id: string): Promise<Photo | null> {
  const response = await serverApiFetch(`/api/photos/${id}`);
  if (response.status === 404) return null;

  const result = await readJsonResult<{ photo: Photo | null }>(response);
  return result.ok ? result.data.photo : null;
}

export async function getAbout(): Promise<About | null> {
  const response = await serverApiFetch("/api/about");
  const result = await readJsonResult<{ about: About | null }>(response);
  return result.ok ? result.data.about : null;
}
