import PhotoDetails from "@/components/photo/photo-details";
import PhotoLightbox from "@/components/photo/photo-lightbox";
import { getPhoto } from "@/services/supabase/photos";
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
  if (!photo) return { title: "Photo not found" };
  return {
    title: photo.title,
    description: photo.description || undefined,
  };
}

export default async function PhotoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const photo = await getPhoto(id);

  if (!photo) notFound();

  return (
    <article className="pb-20">
      <div className="mx-auto w-full max-w-[1600px] px-4">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to gallery
        </Link>
        <div className="overflow-hidden border border-black/10">
          <PhotoLightbox photo={photo} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-4 pt-10">
        <PhotoDetails photo={photo} />
      </div>
    </article>
  );
}
