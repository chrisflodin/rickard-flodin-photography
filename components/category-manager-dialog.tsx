"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UploadButton from "@/components/gallery/upload-button";
import PhotoImage from "@/components/photo-image";
import { apiMutation } from "@/lib/api-client/client";
import type { Category, Photo } from "@/types/photo";

async function loadPhotos(category: Category) {
  const response = await fetch(
    `/api/photos?category=${encodeURIComponent(category.slug)}`
  );
  const result = (await response.json().catch(() => null)) as
    | { ok: true; data: { photos: Photo[] } }
    | null;
  return result?.ok ? result.data.photos : [];
}

export default function CategoryManagerDialog({
  category,
  categories,
  open,
  onOpenChange,
}: {
  category: Category;
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [featuredPhotoId, setFeaturedPhotoId] = useState(
    category.featured_photo_id
  );
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setFeaturedPhotoId(category.featured_photo_id);
  }, [category.featured_photo_id]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadPhotos(category)
      .then(setPhotos)
      .catch(() => {
        toast.error("Could not load category photos");
        setPhotos([]);
      })
      .finally(() => setLoading(false));
  }, [category, open]);

  async function chooseFeatured(photoId: string | null) {
    setSaving(true);
    const result = await apiMutation(`/api/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured_photo_id: photoId }),
    });
    setSaving(false);
    if (!result.ok) return toast.error(result.error);
    setFeaturedPhotoId(photoId);
    toast.success(photoId ? "Featured image updated" : "Featured image cleared");
    router.refresh();
  }

  async function deleteCategory() {
    setSaving(true);
    const result = await apiMutation(`/api/categories/${category.id}`, {
      method: "DELETE",
    });
    setSaving(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Category deleted");
    setDeleteOpen(false);
    onOpenChange(false);
    window.location.assign("/");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage {category.name}</DialogTitle>
            <DialogDescription>
              Upload images to this category or choose one as its landing-page
              image.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <UploadButton
              categories={categories}
              defaultCategoryId={category.id}
              lockCategory
            />
            {featuredPhotoId && (
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => chooseFeatured(null)}
              >
                Clear featured image
              </Button>
            )}
          </div>
          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 animate-spin" />
              Loading images…
            </div>
          ) : photos.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed text-center text-muted-foreground">
              Upload the first image for this category.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo) => {
                const featured = photo.id === featuredPhotoId;
                return (
                  <button
                    key={photo.id}
                    type="button"
                    disabled={saving}
                    onClick={() => chooseFeatured(photo.id)}
                    className="group relative overflow-hidden rounded-md border text-left disabled:cursor-wait disabled:opacity-60"
                    aria-pressed={featured}
                  >
                    <PhotoImage
                      photo={photo}
                      className="aspect-square object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1.5 text-xs text-white">
                      {featured ? "Featured image" : "Set as featured"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <DialogFooter className="border-t pt-4 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={saving}
            >
              <Trash2 />
              Delete category
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {category.name}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Categories containing images cannot be
              deleted; remove or move those images first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteCategory} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Delete category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
