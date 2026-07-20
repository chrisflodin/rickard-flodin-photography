import type { Metadata } from "next";
import { getCategories } from "@/lib/api-client/photos";
import CategoryGrid from "@/components/category-grid";
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
  const categories = await getCategories();

  return (
    <div className="pt-2">
      <CategoryGrid categories={categories} />
    </div>
  );
}
