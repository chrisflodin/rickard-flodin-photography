import "server-only";
import { createClient } from "@/services/supabase/server";
import type { About, GallerySettings, Photo } from "@/types/photo";

export const DEFAULT_COLUMNS_COUNT = 3;

export async function getPhotos(): Promise<Photo[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
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
    const supabase = await createClient();
    const { data, error } = await supabase
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
    const supabase = await createClient();
    const { data, error } = await supabase
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
    const supabase = await createClient();
    const { data, error } = await supabase
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
