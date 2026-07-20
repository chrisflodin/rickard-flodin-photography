"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiMutation } from "@/lib/api-client/client";
import type { Category } from "@/types/photo";

export default function UploadButton({
  categories,
  defaultCategoryId,
  lockCategory = false,
}: {
  categories: Category[];
  defaultCategoryId: string;
  lockCategory?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [digitalPrice, setDigitalPrice] = useState("");
  const [printA3Price, setPrintA3Price] = useState("");
  const [printA2Price, setPrintA2Price] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);

  function beginUpload() {
    setFile(null);
    setTitle("");
    setDescription("");
    setDigitalPrice("");
    setPrintA3Price("");
    setPrintA2Price("");
    setCategoryId(defaultCategoryId);
    if (inputRef.current) inputRef.current.value = "";
    setOpen(true);
  }

  function handleFileSelected(selected: File | null) {
    if (!selected) return;
    setFile(selected);
    setTitle(selected.name.replace(/\.[^/.]+$/, ""));
  }

  async function uploadFile() {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("title", title);
    body.append("description", description);
    body.append("digital_price", digitalPrice);
    body.append("print_a3_price", printA3Price);
    body.append("print_a2_price", printA2Price);
    body.append("category_id", categoryId);
    return apiMutation("/api/photos", { method: "POST", body });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    const result = await uploadFile();
    setUploading(false);
    if (result?.ok) {
      toast.success("Photo uploaded");
      setOpen(false);
      setFile(null);
      router.refresh();
    } else {
      toast.error(result?.error || "Upload failed");
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        onClick={beginUpload}
        disabled={uploading}
        size="sm"
      >
        {uploading ? (
          <>
            <Loader2 className="animate-spin" />
            Uploading
          </>
        ) : (
          <>
            <ImagePlus />
            Upload photos
          </>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add photo</DialogTitle>
            <DialogDescription>
              Add the image details before uploading it to the gallery.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label>Image</Label>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                <ImagePlus />
                {file ? "Replace image" : "Upload image"}
              </Button>
              <p className="text-sm text-muted-foreground">
                {file ? file.name : "No image selected"}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="upload-title">Title</Label>
              <Input
                id="upload-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="upload-description">Description (optional)</Label>
              <Textarea
                id="upload-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={5000}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="upload-digital-price">Digital (SEK, incl. VAT)</Label>
                <Input
                  id="upload-digital-price"
                  type="number"
                  min="0"
                  step="1"
                  value={digitalPrice}
                  onChange={(event) => setDigitalPrice(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="upload-a3-price">Print A3 (SEK, incl. VAT)</Label>
                <Input
                  id="upload-a3-price"
                  type="number"
                  min="0"
                  step="1"
                  value={printA3Price}
                  onChange={(event) => setPrintA3Price(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="upload-a2-price">Print A2 (SEK, incl. VAT)</Label>
                <Input
                  id="upload-a2-price"
                  type="number"
                  min="0"
                  step="1"
                  value={printA2Price}
                  onChange={(event) => setPrintA2Price(event.target.value)}
                  required
                />
              </div>
            </div>
            {!lockCategory && (
              <div className="grid gap-2">
                <Label htmlFor="upload-category">Category</Label>
                <select
                  id="upload-category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={uploading || !file}>
                {uploading && <Loader2 className="animate-spin" />}
                Upload photo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
