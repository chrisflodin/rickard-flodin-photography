"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function UploadButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  async function uploadFile(file: File) {
    const body = new FormData();
    body.append("file", file);
    body.append("title", file.name.replace(/\.[^/.]+$/, ""));

    const res = await fetch("/api/photos", { method: "POST", body });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Upload failed");
    }
  }

  async function handleFiles(files: FileList) {
    const list = Array.from(files);
    setUploading(true);
    setProgress({ done: 0, total: list.length });

    let success = 0;
    for (const file of list) {
      try {
        await uploadFile(file);
        success += 1;
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      } catch (err) {
        toast.error(
          `${file.name}: ${err instanceof Error ? err.message : "failed"}`
        );
      }
    }

    setUploading(false);
    setProgress({ done: 0, total: 0 });
    if (success > 0) {
      toast.success(
        `Uploaded ${success} image${success > 1 ? "s" : ""}`
      );
      router.refresh();
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        size="sm"
      >
        {uploading ? (
          <>
            <Loader2 className="animate-spin" />
            Uploading {progress.done}/{progress.total}
          </>
        ) : (
          <>
            <ImagePlus />
            Upload photos
          </>
        )}
      </Button>
    </>
  );
}
