import PhotoDetails from "@/components/photo/photo-details";
import PhotoLightbox from "@/components/photo/photo-lightbox";
import { getCategories, getPhoto } from "@/lib/api-client/photos";
import { getCanonicalUrl, siteConfig } from "@/lib/constants";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const photo = await getPhoto(id);
  if (!photo) {
    return {
      title: "Photo not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description =
    photo.description ||
    `${photo.title}, a photograph by ${siteConfig.creator}.`;
  const url = getCanonicalUrl(`/photos/${photo.id}`);
  const images = photo.image_url
    ? [
        {
          url: photo.image_url,
          width: photo.width,
          height: photo.height,
          alt: photo.title,
        },
      ]
    : undefined;

  return {
    title: photo.title,
    description,
    alternates: {
      canonical: `/photos/${photo.id}`,
    },
    openGraph: {
      type: "article",
      url,
      title: photo.title,
      description,
      siteName: siteConfig.name,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: photo.title,
      description,
      images: photo.image_url ? [photo.image_url] : undefined,
    },
  };
}

export default async function PhotoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [photo, categories] = await Promise.all([getPhoto(id), getCategories()]);

  if (!photo) notFound();
  const category = categories.find((item) => item.id === photo.category_id);
  const backHref = category ? `/categories/${category.slug}` : "/";

  const description =
    photo.description ||
    `${photo.title}, a photograph by ${siteConfig.creator}.`;
  const photoUrl = getCanonicalUrl(`/photos/${photo.id}`);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    "@id": `${photoUrl}#image`,
    name: photo.title,
    description,
    url: photoUrl,
    contentUrl: photo.image_url,
    width: photo.width,
    height: photo.height,
    creator: {
      "@type": "Person",
      name: siteConfig.creator,
    },
    creditText: siteConfig.creator,
    copyrightHolder: {
      "@type": "Person",
      name: siteConfig.creator,
    },
    datePublished: photo.created_at,
    offers: [
      ["Digital download", photo.digital_price],
      ["Print A3", photo.print_a3_price],
      ["Print A2", photo.print_a2_price],
    ]
      .filter(([, price]) => price != null)
      .map(([name, price]) => ({
        "@type": "Offer",
        name,
        price,
        priceCurrency: "SEK",
        availability: "https://schema.org/InStock",
        url: photoUrl,
      })),
  };

  return (
    <article className="pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="w-full px-4 lg:px-[90px]">
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {category?.name ?? "categories"}
        </Link>
        <div className="overflow-hidden border border-black/10">
          <PhotoLightbox photo={photo} />
        </div>
      </div>

      <div className="w-full px-4 pt-10 lg:px-[90px]">
        <PhotoDetails photo={photo} />
      </div>
    </article>
  );
}
