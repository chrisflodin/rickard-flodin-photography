"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/admin-provider";
import CategoryManagerDialog from "@/components/category-manager-dialog";
import { Button } from "@/components/ui/button";
import { apiMutation } from "@/lib/api-client/client";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/photo";

function CategoryCard({
  category,
  categories,
}: {
  category: Category;
  categories: Category[];
}) {
  const isAdmin = useAdmin();
  const [manageOpen, setManageOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled: !isAdmin });

  return (
    <>
      <article
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        className={cn(
          "group relative aspect-square overflow-hidden bg-muted",
          isDragging && "z-10 opacity-50 ring-2 ring-primary"
        )}
      >
        <Link
          href={`/categories/${category.slug}`}
          className="absolute inset-0 z-10"
          aria-label={`Open ${category.name}`}
        />
        {category.featured_photo?.image_url ? (
          <Image
            src={category.featured_photo.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="pointer-events-none object-cover transition-transform duration-500 group-hover:scale-105"
            placeholder={category.featured_photo.blur_data_url ? "blur" : "empty"}
            blurDataURL={category.featured_photo.blur_data_url ?? undefined}
          />
        ) : (
          <div className="h-full w-full bg-secondary" />
        )}
        {isAdmin && (
          <>
            <button
              type="button"
              aria-label={`Reorder ${category.name}`}
              className="absolute left-3 top-3 z-20 flex h-9 w-9 cursor-grab items-center justify-center rounded-md bg-background/90 shadow-sm backdrop-blur transition-opacity hover:bg-background active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <Button
              type="button"
              size="sm"
              className="absolute right-3 top-3 z-20"
              onClick={() => setManageOpen(true)}
            >
              Manage
            </Button>
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-5 pb-5 pt-16">
          <h2 className="text-xl font-medium tracking-tight text-white">
            {category.name}
          </h2>
        </div>
      </article>
      {isAdmin && (
        <CategoryManagerDialog
          category={category}
          categories={categories}
          open={manageOpen}
          onOpenChange={setManageOpen}
        />
      )}
    </>
  );
}

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  const isAdmin = useAdmin();
  const [orderedCategories, setOrderedCategories] = useState(categories);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    setOrderedCategories(categories);
  }, [categories]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const previous = orderedCategories;
    const oldIndex = previous.findIndex((category) => category.id === active.id);
    const newIndex = previous.findIndex((category) => category.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(previous, oldIndex, newIndex);
    setOrderedCategories(next);
    const result = await apiMutation("/api/categories/positions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positions: next.map((category, index) => ({
          id: category.id,
          sort_order: index,
        })),
      }),
    });
    if (!result.ok) {
      setOrderedCategories(previous);
      toast.error(result.error || "Could not save category order");
    }
  }

  if (categories.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-center text-muted-foreground">
        No categories yet.
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-16 lg:px-[90px]">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={isAdmin ? handleDragEnd : undefined}
      >
        <SortableContext
          items={orderedCategories.map((category) => category.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {orderedCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                categories={orderedCategories}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
