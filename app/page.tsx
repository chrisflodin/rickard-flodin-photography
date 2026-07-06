import type { Metadata } from "next";
import { getGalleryData } from "@/services/api/photos";
import Gallery from "@/components/gallery/gallery";
import { getCanonicalUrl, siteConfig } from "@/lib/constants";

export const revalidate = 0;

export const metadata: Metadata = {
  title: {
    absolute: siteConfig.title,
  },
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: getCanonicalUrl("/"),
    title: siteConfig.title,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
};

export default async function Home() {
  const { photos, settings } = await getGalleryData();

  return (
    <div className="pt-2">
      <Gallery photos={photos} columnsCount={settings.columns_count} />
    </div>
  );
}
