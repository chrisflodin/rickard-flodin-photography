"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FolderCog, Loader2, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiMutation } from "@/lib/api-client/client";
import type { Category, Photo } from "@/types/photo";

type CategoryPhotos = Record<string, Photo[]>;

async function loadCategoryPhotos(categories: Category[]) {
  const entries = await Promise.all(
    categories.map(async (category) => {
      const response = await fetch(
        `/api/photos?category=${encodeURIComponent(category.slug)}`
      );
      const body = (await response.json().catch(() => null)) as
        | { ok: true; data: { photos: Photo[] } }
        | undefined;
      return [category.id, body?.ok ? body.data.photos : []] as const;
    })
  );
  return Object.fromEntries(entries) as CategoryPhotos;
}

export default function CategoryManager({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<CategoryPhotos>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadCategoryPhotos(categories)
      .then(setPhotos)
      .finally(() => setLoading(false));
  }, [categories, open]);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingId("new");
    const result = await apiMutation("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingId(null);
    if (!result.ok) return toast.error(result.error);
    setName("");
    toast.success("Category added");
    router.refresh();
  }

  async function setFeatured(category: Category, photoId: string) {
    setSavingId(category.id);
    const result = await apiMutation(`/api/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured_photo_id: photoId || null }),
    });
    setSavingId(null);
    if (!result.ok) return toast.error(result.error);
    toast.success(photoId ? "Featured image updated" : "Featured image cleared");
    router.refresh();
  }

  async function deleteCategory(category: Category) {
    if (!confirm(`Delete ${category.name}?`)) return;
    setSavingId(category.id);
    const result = await apiMutation(`/api/categories/${category.id}`, {
      method: "DELETE",
    });
    setSavingId(null);
    if (!result.ok) return toast.error(result.error);
    toast.success("Category deleted");
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FolderCog />
        Manage categories
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage categories</DialogTitle>
            <DialogDescription>
              Create categories, assign a landing-page image, or remove empty
              categories.
            </DialogDescription>
          </DialogHeader>
          <form className="flex gap-2" onSubmit={createCategory}>
            <Label className="sr-only" htmlFor="category-name">
              Category name
            </Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New category name"
              maxLength={80}
              required
            />
            <Button type="submit" disabled={savingId === "new"}>
              {savingId === "new" && <Loader2 className="animate-spin" />}
              Add
            </Button>
          </form>
          <div className="divide-y rounded-md border">
            {categories.map((category) => {
              const categoryPhotos = photos[category.id] ?? [];
              return (
                <div
                  key={category.id}
                  className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-center"
                >
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {loading ? "Loading photos…" : `${categoryPhotos.length} photos`}
                    </p>
                  </div>
                  <select
                    aria-label={`Featured image for ${category.name}`}
                    value={category.featured_photo_id ?? ""}
                    onChange={(event) => setFeatured(category, event.target.value)}
                    disabled={loading || savingId === category.id}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">No featured image</option>
                    {categoryPhotos.map((photo) => (
                      <option key={photo.id} value={photo.id}>
                        {photo.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Delete ${category.name}`}
                    onClick={() => deleteCategory(category)}
                    disabled={categoryPhotos.length > 0 || savingId === category.id}
                    title={
                      categoryPhotos.length > 0
                        ? "Move or delete all photos before removing this category"
                        : "Delete category"
                    }
                  >
                    {savingId === category.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
