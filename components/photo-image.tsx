import Image from "next/image";
import type { Photo } from "@/types/photo";
import { cn } from "@/lib/utils";

interface PhotoImageProps {
  photo: Pick<
    Photo,
    "image_url" | "width" | "height" | "blur_data_url" | "title"
  >;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

export default function PhotoImage({
  photo,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
  priority = false,
  className,
}: PhotoImageProps) {
  const src = photo.image_url ?? "";

  return (
    <Image
      src={src}
      alt={photo.title}
      width={photo.width}
      height={photo.height}
      sizes={sizes}
      priority={priority}
      placeholder={photo.blur_data_url ? "blur" : "empty"}
      blurDataURL={photo.blur_data_url ?? undefined}
      className={cn("h-auto w-full", className)}
    />
  );
}
