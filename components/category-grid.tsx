import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/types/photo";

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-center text-muted-foreground">
        No categories yet.
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-16 lg:px-[90px]">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group relative aspect-square overflow-hidden bg-muted"
          >
            {category.featured_photo?.image_url ? (
              <Image
                src={category.featured_photo.image_url}
                alt={category.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                placeholder={
                  category.featured_photo.blur_data_url ? "blur" : "empty"
                }
                blurDataURL={category.featured_photo.blur_data_url ?? undefined}
              />
            ) : (
              <div className="h-full w-full bg-secondary" />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-5 pt-16">
              <h2 className="text-xl font-medium tracking-tight text-white">
                {category.name}
              </h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
