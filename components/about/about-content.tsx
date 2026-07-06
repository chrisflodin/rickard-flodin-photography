"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/admin-provider";
import { updateAbout } from "@/app/actions/about";
import { getPublicUrl } from "@/services/supabase/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { About } from "@/types/photo";

export default function AboutContent({ about }: { about: About | null }) {
  const isAdmin = useAdmin();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [body, setBody] = useState(about?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const imagePath = about?.photographer_image_path ?? null;
  const imageUrl = imagePath
    ? getPublicUrl(STORAGE_BUCKETS.about, imagePath)
    : null;

  const dirty = body !== (about?.body ?? "");

  async function handleSave() {
    setSaving(true);
    const result = await updateAbout(body);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error || "Could not save");
      return;
    }
    toast.success("Saved");
    router.refresh();
  }

  async function handleImage(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/about", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Upload failed");
      return;
    }
    toast.success("Photo updated");
    router.refresh();
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16">
      <div className="space-y-3">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt="Photographer"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <User className="h-16 w-16" />
            </div>
          )}
        </div>

        {isAdmin && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) =>
                e.target.files?.[0] && handleImage(e.target.files[0])
              }
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <ImagePlus />
                  {imageUrl ? "Replace photo" : "Upload photo"}
                </>
              )}
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-col justify-center">
        <h1 className="text-3xl font-semibold tracking-tight">About</h1>
        {isAdmin ? (
          <div className="mt-4 space-y-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="Write a little about the photographer..."
            />
            {dirty && (
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            )}
          </div>
        ) : body ? (
          <p className="mt-4 max-w-prose whitespace-pre-wrap text-muted-foreground">
            {body}
          </p>
        ) : (
          <p className="mt-4 text-muted-foreground">
            Details coming soon.
          </p>
        )}
      </div>
    </div>
  );
}
