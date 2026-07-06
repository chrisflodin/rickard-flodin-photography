import { getGallerySettings, getPhotos } from "@/services/supabase/photos";
import Gallery from "@/components/gallery/gallery";

export const revalidate = 0;

export default async function Home() {
  const [photos, settings] = await Promise.all([
    getPhotos(),
    getGallerySettings(),
  ]);

  return (
    <div className="pt-2">
      <Gallery photos={photos} columnsCount={settings.columns_count} />
    </div>
  );
}
