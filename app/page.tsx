import { getGalleryData } from "@/services/api/photos";
import Gallery from "@/components/gallery/gallery";

export const revalidate = 0;

export default async function Home() {
  const { photos, settings } = await getGalleryData();

  return (
    <div className="pt-2">
      <Gallery photos={photos} columnsCount={settings.columns_count} />
    </div>
  );
}
