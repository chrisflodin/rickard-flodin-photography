"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin/admin-provider";
import { apiMutation } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/utils";
import type { Photo } from "@/types/photo";

export default function PhotoDetails({ photo }: { photo: Photo }) {
  const isAdmin = useAdmin();
  const router = useRouter();

  const [title, setTitle] = useState(photo.title);
  const [description, setDescription] = useState(photo.description);
  const [price, setPrice] = useState<string>(
    photo.price != null ? String(photo.price) : ""
  );
  const [saving, setSaving] = useState(false);

  const dirty =
    title !== photo.title ||
    description !== photo.description ||
    (price === "" ? photo.price != null : Number(price) !== photo.price);

  async function handleSave() {
    if (title.trim().length === 0) {
      toast.error("Title is required");
      return;
    }
    const parsedPrice = price.trim() === "" ? null : Number(price);
    if (parsedPrice != null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      toast.error("Price must be a positive number");
      return;
    }

    setSaving(true);
    const result = await apiMutation(`/api/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description,
        price: parsedPrice,
      }),
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error || "Could not save");
      return;
    }
    toast.success("Saved");
    router.refresh();
  }

  if (!isAdmin) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {photo.title}
          </h1>
          {photo.description && (
            <p className="whitespace-pre-wrap text-muted-foreground">
              {photo.description}
            </p>
          )}
        </div>
        <OrderBox price={photo.price} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Name
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg"
            placeholder="Name of picture"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Description"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Price (optional)
          </label>
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 1500"
            className="max-w-[200px]"
          />
        </div>
        {dirty && (
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        )}
      </div>
      <OrderBox price={price.trim() === "" ? null : Number(price)} />
    </div>
  );
}

function OrderBox({ price }: { price: number | null }) {
  return (
    <aside className="h-fit w-full rounded-lg border p-6 md:w-64">
      <h2 className="text-sm font-semibold uppercase tracking-wide">Order</h2>
      {price != null && !Number.isNaN(price) && (
        <p className="mt-3 text-lg">{formatPrice(price)}</p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        Interested in this print? Get in touch to order.
      </p>
      <Button
        className="mt-4 w-full"
        onClick={() => {
          // TODO: define ordering flow.
        }}
      >
        Order
      </Button>
    </aside>
  );
}
