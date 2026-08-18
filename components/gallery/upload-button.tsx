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
import {
  prepareWebImage,
  validateOriginal,
  type PreparedWebImage,
} from "@/lib/client-image";
import {
  cleanupOriginal,
  getOriginalUploadStatus,
  uploadOriginal,
} from "@/lib/client-original-upload";
import type { Category } from "@/types/photo";

type UploadPhase = "idle" | "optimizing" | "uploading-original" | "finalizing";

async function recoveryKey(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `photo-original-upload:${hash}`;
}

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
  const pendingUploadRef = useRef<{
    source: File;
    webImage: PreparedWebImage;
    originalPath: string;
    recoveryKey: string;
  } | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [digitalPrice, setDigitalPrice] = useState("");
  const [printA3Price, setPrintA3Price] = useState("");
  const [printA2Price, setPrintA2Price] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const uploading = uploadPhase !== "idle";

  function beginUpload() {
    setFile(null);
    setTitle("");
    setDescription("");
    setDigitalPrice("");
    setPrintA3Price("");
    setPrintA2Price("");
    setCategoryId(defaultCategoryId);
    setUploadPhase("idle");
    setUploadProgress(0);
    pendingUploadRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
    setOpen(true);
  }

  function handleFileSelected(selected: File | null) {
    if (!selected) return;
    try {
      validateOriginal(selected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid image");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    pendingUploadRef.current = null;
    setFile(selected);
    setTitle(selected.name.replace(/\.[^/.]+$/, ""));
  }

  async function uploadFile() {
    if (!file) return;

    try {
      let pending = pendingUploadRef.current;
      if (!pending || pending.source !== file) {
        setUploadPhase("optimizing");
        const webImage = await prepareWebImage(file);
        const storedRecoveryKey = await recoveryKey(file);
        let originalPath = window.localStorage.getItem(storedRecoveryKey);

        if (originalPath) {
          try {
            const status = await getOriginalUploadStatus(originalPath);
            if (status.status === "finalized") {
              window.localStorage.removeItem(storedRecoveryKey);
              return { ok: true as const };
            }
            if (status.status === "missing" || status.status === "deleting") {
              window.localStorage.removeItem(storedRecoveryKey);
              originalPath = null;
            }
          } catch {
            // Reuse the path; the idempotent finalization route will reconcile it.
          }
        }

        if (!originalPath) {
          setUploadPhase("uploading-original");
          setUploadProgress(0);
          originalPath = await uploadOriginal(file, setUploadProgress);
          window.localStorage.setItem(storedRecoveryKey, originalPath);
        }

        pending = {
          source: file,
          webImage,
          originalPath,
          recoveryKey: storedRecoveryKey,
        };
        pendingUploadRef.current = pending;
      }

      let lastError = "Photo finalization failed";
      for (let attempt = 0; attempt < 3; attempt += 1) {
        setUploadPhase("finalizing");
        const body = new FormData();
        body.append("file", pending.webImage.file);
        body.append(
          "preserve_prepared_webp",
          String(pending.webImage.preservePreparedWebp)
        );
        body.append("original_storage_path", pending.originalPath);
        body.append("title", title);
        body.append("description", description);
        body.append("digital_price", digitalPrice);
        body.append("print_a3_price", printA3Price);
        body.append("print_a2_price", printA2Price);
        body.append("category_id", categoryId);

        try {
          const result = await apiMutation("/api/photos", {
            method: "POST",
            body,
          });
          if (result.ok) {
            window.localStorage.removeItem(pending.recoveryKey);
            pendingUploadRef.current = null;
            return result;
          }
          lastError = result.error;
        } catch (error) {
          lastError = error instanceof Error ? error.message : lastError;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 750));
      }

      try {
        const status = await getOriginalUploadStatus(pending.originalPath);
        if (status.status === "finalized") {
          window.localStorage.removeItem(pending.recoveryKey);
          pendingUploadRef.current = null;
          return { ok: true as const };
        }
        if (status.status === "missing" || status.status === "deleting") {
          await cleanupOriginal(pending.originalPath);
          window.localStorage.removeItem(pending.recoveryKey);
          pendingUploadRef.current = null;
        }
      } catch {
        // Keep the staged path so the next click retries idempotently.
      }

      return { ok: false as const, error: lastError };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const result = await uploadFile();
    setUploadPhase("idle");
    setUploadProgress(0);
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
        accept="image/jpeg,image/png,image/webp"
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
            {uploadPhase === "optimizing"
              ? "Optimizing"
              : uploadPhase === "uploading-original"
                ? `Uploading ${uploadProgress}%`
                : "Finishing"}
          </>
        ) : (
          <>
            <ImagePlus />
            Upload photos
          </>
        )}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!uploading) setOpen(nextOpen);
        }}
      >
        <DialogContent className="max-w-2xl">
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
              <p className="text-xs text-muted-foreground">
                The full-resolution original is stored privately. A high-quality web
                copy is created automatically.
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
                <Label htmlFor="upload-digital-price">Digital (SEK, inkl. moms)</Label>
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
                <Label htmlFor="upload-a3-price">Tryck A3 (SEK, inkl. moms)</Label>
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
                <Label htmlFor="upload-a2-price">Tryck A2 (SEK, inkl. moms)</Label>
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
                {uploadPhase === "optimizing"
                  ? "Optimizing image"
                  : uploadPhase === "uploading-original"
                    ? `Uploading original ${uploadProgress}%`
                    : uploadPhase === "finalizing"
                      ? "Finishing upload"
                      : "Upload photo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
