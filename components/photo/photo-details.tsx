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
import OrderDialog from "@/components/photo/order-dialog";

export default function PhotoDetails({ photo }: { photo: Photo }) {
  const isAdmin = useAdmin();
  const router = useRouter();

  const [title, setTitle] = useState(photo.title);
  const [description, setDescription] = useState(photo.description);
  const [digitalPrice, setDigitalPrice] = useState(
    photo.digital_price != null ? String(photo.digital_price) : ""
  );
  const [printA3Price, setPrintA3Price] = useState(
    photo.print_a3_price != null ? String(photo.print_a3_price) : ""
  );
  const [printA2Price, setPrintA2Price] = useState(
    photo.print_a2_price != null ? String(photo.print_a2_price) : ""
  );
  const [saving, setSaving] = useState(false);

  const dirty =
    title !== photo.title ||
    description !== photo.description ||
    (digitalPrice === "" ? photo.digital_price != null : Number(digitalPrice) !== photo.digital_price) ||
    (printA3Price === "" ? photo.print_a3_price != null : Number(printA3Price) !== photo.print_a3_price) ||
    (printA2Price === "" ? photo.print_a2_price != null : Number(printA2Price) !== photo.print_a2_price);

  async function handleSave() {
    if (title.trim().length === 0) {
      toast.error("Title is required");
      return;
    }
    const prices = [digitalPrice, printA3Price, printA2Price].map((price) =>
      price.trim() === "" ? null : Number(price)
    );
    if (prices.some((price) => price != null && (Number.isNaN(price) || price < 0))) {
      toast.error("Prices must be non-negative numbers");
      return;
    }

    setSaving(true);
    const result = await apiMutation(`/api/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description,
        digital_price: prices[0],
        print_a3_price: prices[1],
        print_a2_price: prices[2],
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
        <OrderBox photo={photo} />
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
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Digital", digitalPrice, setDigitalPrice],
            ["Print A3", printA3Price, setPrintA3Price],
            ["Print A2", printA2Price, setPrintA2Price],
          ].map(([label, value, setValue]) => (
            <div key={label as string} className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                {label as string} (SEK, incl. VAT)
              </label>
              <Input
                value={value as string}
                onChange={(e) => (setValue as (value: string) => void)(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 1500"
              />
            </div>
          ))}
        </div>
        {dirty && (
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        )}
      </div>
      <OrderBox
        photo={{
          ...photo,
          digital_price: digitalPrice.trim() === "" ? null : Number(digitalPrice),
          print_a3_price: printA3Price.trim() === "" ? null : Number(printA3Price),
          print_a2_price: printA2Price.trim() === "" ? null : Number(printA2Price),
        }}
      />
    </div>
  );
}

function OrderBox({ photo }: { photo: Photo }) {
  const prices = [
    ["Digital", photo.digital_price],
    ["Print A3", photo.print_a3_price],
    ["Print A2", photo.print_a2_price],
  ].filter(([, price]) => price != null && !Number.isNaN(price));
  return (
    <aside className="h-fit w-full rounded-lg border p-6 md:w-64">
      <h2 className="text-sm font-semibold uppercase tracking-wide">Order</h2>
      <dl className="mt-3 space-y-2 text-sm">
        {prices.map(([label, price]) => (
          <div key={label as string} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label as string}</dt>
            <dd>{formatPrice(price as number)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-muted-foreground">
        Prices include 25% VAT. Select a format to place an order request.
      </p>
      <OrderDialog photo={photo} />
    </aside>
  );
}
