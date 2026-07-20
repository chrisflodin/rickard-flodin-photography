import "server-only";
import { createRequestClient } from "@/lib/server/backend/request-client";
import type { About, Category, GallerySettings, Photo } from "@/types/photo";

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

export async function getPhotosByCategory(categoryId: string): Promise<Photo[]> {
  try {
    const client = await createRequestClient();
    const { data, error } = await client
      .from("photos")
      .select("*")
      .eq("category_id", categoryId)
      .order("column_index", { ascending: true })
      .order("column_order", { ascending: true });

    if (error) throw error;
    return (data as Photo[]) ?? [];
  } catch {
    return [];
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const client = await createRequestClient();
    const { data: categories, error } = await client
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    const rows = (categories as Omit<Category, "featured_photo">[]) ?? [];
    const featuredIds = rows
      .map((category) => category.featured_photo_id)
      .filter((id): id is string => Boolean(id));

    if (featuredIds.length === 0) {
      return rows.map((category) => ({ ...category, featured_photo: null }));
    }

    const { data: featuredPhotos, error: photosError } = await client
      .from("photos")
      .select("id, storage_path, width, height, blur_data_url")
      .in("id", featuredIds);
    if (photosError) throw photosError;

    const byId = new Map(
      ((featuredPhotos ?? []) as Category["featured_photo"][]).flatMap((photo) =>
        photo ? [[photo.id, photo]] : []
      )
    );

    return rows.map((category) => ({
      ...category,
      featured_photo: category.featured_photo_id
        ? byId.get(category.featured_photo_id) ?? null
        : null,
    }));
  } catch {
    return [];
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug) ?? null;
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
