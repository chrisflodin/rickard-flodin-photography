import "server-only";
import { createRequestClient } from "@/lib/server/backend/request-client";
import type { About, GallerySettings, Photo } from "@/types/photo";

export const DEFAULT_COLUMNS_COUNT = 3;

export async function getPhotos(): Promise<Photo[]> {
  try {
    const client = await createRequestClient();
    const { data, error } = await client
      .from("photos")
      .select("*")
      .order("column_index", { ascending: true })
      .order("column_order", { ascending: true });

    if (error) throw error;
    return (data as Photo[]) ?? [];
  } catch {
    return [];
  }
}

export async function getGallerySettings(): Promise<GallerySettings> {
  try {
    const client = await createRequestClient();
    const { data, error } = await client
      .from("gallery_settings")
      .select("columns_count")
      .eq("id", true)
      .maybeSingle();

    if (error) throw error;
    return {
      columns_count: data?.columns_count ?? DEFAULT_COLUMNS_COUNT,
    };
  } catch {
    return { columns_count: DEFAULT_COLUMNS_COUNT };
  }
}

export async function getPhoto(id: string): Promise<Photo | null> {
  try {
    const client = await createRequestClient();
    const { data, error } = await client
      .from("photos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return (data as Photo) ?? null;
  } catch {
    return null;
  }
}

export async function getAbout(): Promise<About | null> {
  try {
    const client = await createRequestClient();
    const { data, error } = await client
      .from("about")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (error) throw error;
    return (data as About) ?? null;
  } catch {
    return null;
  }
}
