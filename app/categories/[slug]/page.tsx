import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Gallery from "@/components/gallery/gallery";
import {
  getCategories,
  getCategoryGalleryData,
} from "@/lib/api-client/photos";
import { getCanonicalUrl, siteConfig } from "@/lib/constants";

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) return { title: "Category not found", robots: { index: false } };

  const title = category.name;
  const description = `${category.name} photography by ${siteConfig.creator}.`;
  return {
    title,
    description,
    alternates: { canonical: `/categories/${category.slug}` },
    openGraph: {
      type: "website",
      url: getCanonicalUrl(`/categories/${category.slug}`),
      title,
      description,
      images: category.featured_photo?.image_url
        ? [{ url: category.featured_photo.image_url }]
        : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const gallery = await getCategoryGalleryData(slug);
  if (!gallery) notFound();

  return (
    <div className="pt-2">
      <Gallery
        photos={gallery.photos}
        columnsCount={gallery.settings.columns_count}
        category={category}
        categories={categories}
      />
    </div>
  );
}
