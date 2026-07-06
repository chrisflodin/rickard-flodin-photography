"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import PhotoImage from "@/components/photo-image";
import type { Photo } from "@/types/photo";

export function PhotoCard({
  photo,
  priority,
}: {
  photo: Photo;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/photos/${photo.id}`}
      className="relative block cursor-pointer overflow-hidden"
    >
      <PhotoImage photo={photo} priority={priority} />
    </Link>
  );
}

export function SortablePhotoCard({
  photo,
  onDelete,
}: {
  photo: Photo;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative select-none overflow-hidden",
        isDragging && "z-50 opacity-40 ring-2 ring-primary"
      )}
    >
      <div className="pointer-events-none">
        <PhotoImage photo={photo} />
      </div>

      {/* Large drag handle to make cross-column placement easier. */}
      <button
        type="button"
        aria-label="Drag to reorder"
        className="absolute bottom-0 left-0 top-0 z-10 flex w-16 cursor-grab items-start justify-center pt-3 text-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing sm:w-20"
        {...attributes}
        {...listeners}
      >
        <span className="flex h-12 w-10 items-center justify-center rounded-md bg-background/85 shadow-sm backdrop-blur hover:bg-background sm:h-14 sm:w-12">
          <GripVertical className="h-5 w-5" />
        </span>
      </button>

      <button
        type="button"
        aria-label="Delete photo"
        onClick={() => onDelete(photo.id)}
        className="absolute bottom-0 right-0 top-0 z-20 flex w-16 items-start justify-center pt-3 text-destructive opacity-0 transition-opacity group-hover:opacity-100 sm:w-20"
      >
        <span className="flex h-12 w-10 items-center justify-center rounded-md bg-background/85 shadow-sm backdrop-blur hover:bg-background sm:h-14 sm:w-12">
          <Trash2 className="h-5 w-5" />
        </span>
      </button>

      <Link
        href={`/photos/${photo.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Open ${photo.title}`}
      />
    </div>
  );
}

export function CompactSortablePhotoCard({
  photo,
  onDelete,
}: {
  photo: Photo;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-md bg-muted",
        isDragging && "z-50 opacity-40 ring-2 ring-primary"
      )}
    >
      <div className="pointer-events-none h-full w-full">
        <PhotoImage photo={photo} className="h-full w-full object-cover" />
      </div>

      <button
        type="button"
        aria-label="Drag to place in gallery"
        className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      />

      <button
        type="button"
        aria-label="Delete photo"
        onClick={() => onDelete(photo.id)}
        className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded bg-background/85 text-destructive opacity-0 shadow-sm backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
