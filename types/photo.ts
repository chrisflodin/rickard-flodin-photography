export interface Photo {
  id: string;
  category_id: string;
  title: string;
  description: string;
  price: number | null;
  storage_path: string;
  image_url?: string;
  width: number;
  height: number;
  blur_data_url: string | null;
  sort_order: number;
  column_index: number;
  column_order: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  featured_photo_id: string | null;
  featured_photo: Pick<
    Photo,
    "id" | "storage_path" | "image_url" | "width" | "height" | "blur_data_url"
  > | null;
  created_at: string;
}

export interface GallerySettings {
  columns_count: number;
}

export interface PhotoPosition {
  id: string;
  column_index: number;
  column_order: number;
}

export interface About {
  id: boolean;
  body: string;
  photographer_image_path: string | null;
  photographer_image_url?: string | null;
  updated_at: string;
}

export type PhotoUpdate = Partial<
  Pick<Photo, "title" | "description" | "price">
>;
