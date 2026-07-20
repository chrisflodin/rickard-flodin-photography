"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
import { cn, formatPrice } from "@/lib/utils";
import type { Photo, PrintSize } from "@/types/photo";

export default function OrderDialog({ photo }: { photo: Photo }) {
  const [open, setOpen] = useState(false);
  const [productType, setProductType] = useState<"digital" | "print" | null>(
    null
  );
  const [printSize, setPrintSize] = useState<PrintSize | null>(null);
  const [isBusiness, setIsBusiness] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [organizationNumber, setOrganizationNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState<number | null>(null);

  const price = useMemo(
    () =>
      productType == null
        ? null
        : productType === "digital"
        ? photo.digital_price
        : printSize == null
          ? null
          : printSize === "A3"
          ? photo.print_a3_price
          : photo.print_a2_price,
    [photo, printSize, productType]
  );

  function startOrder() {
    setInvoiceNumber(null);
    setProductType(null);
    setPrintSize(null);
    setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (productType == null) {
      toast.error("Select a format before submitting");
      return;
    }
    if (price == null || (productType === "print" && printSize == null)) {
      toast.error("Select a print size before submitting");
      return;
    }
    setSubmitting(true);
    const result = await apiMutation<{ invoice_number: number; email_sent: boolean }>(
      "/api/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_id: photo.id,
          product_type: productType,
          print_size: productType === "print" ? printSize : null,
          is_business: isBusiness,
          customer_company_name: isBusiness ? companyName : null,
          customer_organization_number: isBusiness ? organizationNumber : null,
          customer_vat_number: isBusiness ? vatNumber : null,
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          customer_address_line1: address,
          customer_postal_code: postalCode,
          customer_city: city,
        }),
      }
    );
    setSubmitting(false);
    if (!("data" in result)) {
      toast.error(result.error || "Could not submit order");
      return;
    }
    setInvoiceNumber(result.data.invoice_number);
  }

  return (
    <>
      <Button
        className="mt-4 w-full"
        onClick={startOrder}
        disabled={
          photo.digital_price == null &&
          photo.print_a3_price == null &&
          photo.print_a2_price == null
        }
      >
        Order
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {invoiceNumber ? "Order received" : `Order ${photo.title}`}
            </DialogTitle>
            <DialogDescription>
              {invoiceNumber
                ? "We’ve sent you an email with information on how to complete your purchase."
                : "Select the format, then provide your invoice and delivery details."}
            </DialogDescription>
          </DialogHeader>
          {invoiceNumber ? (
            <div className="space-y-3 py-4">
              <p className="font-medium">
                Thank you. Your order number is {invoiceNumber}.
              </p>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={submit}>
              <fieldset className="space-y-3">
                <legend className="mb-2 text-base font-semibold">
                  Choose a format
                </legend>
                <div className="grid gap-3">
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50",
                      productType === "digital" && "border-foreground bg-accent",
                      photo.digital_price == null &&
                        "cursor-not-allowed opacity-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="order-format"
                      value="digital"
                      checked={productType === "digital"}
                      onChange={() => {
                        setProductType("digital");
                        setPrintSize(null);
                      }}
                      disabled={photo.digital_price == null}
                      className="h-4 w-4 accent-foreground"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Digital</span>
                      <span className="block text-sm text-muted-foreground">
                        High-resolution digital image
                      </span>
                    </span>
                    {photo.digital_price != null && (
                      <span className="font-medium">
                        {formatPrice(photo.digital_price)}
                      </span>
                    )}
                  </label>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50",
                      productType === "print" && "border-foreground bg-accent",
                      photo.print_a3_price == null &&
                        photo.print_a2_price == null &&
                        "cursor-not-allowed opacity-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="order-format"
                      value="print"
                      checked={productType === "print"}
                      onChange={() => {
                        setProductType("print");
                        setPrintSize(null);
                      }}
                      disabled={
                        photo.print_a3_price == null &&
                        photo.print_a2_price == null
                      }
                      className="h-4 w-4 accent-foreground"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Print</span>
                      <span className="block text-sm text-muted-foreground">
                        Fine-art print in A3 or A2
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>
              {productType === "print" && (
                <fieldset className="space-y-3 rounded-lg bg-muted/50 p-4">
                  <legend className="px-1 text-sm font-semibold">
                    Choose print size
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["A3", "A2"] as const).map((size) => {
                      const sizePrice =
                        size === "A3" ? photo.print_a3_price : photo.print_a2_price;
                      return (
                        <label
                          key={size}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-md border bg-background p-3 transition-colors hover:bg-accent",
                            printSize === size && "border-foreground",
                            sizePrice == null && "cursor-not-allowed opacity-50"
                          )}
                        >
                          <input
                            type="radio"
                            name="print-size"
                            value={size}
                            checked={printSize === size}
                            onChange={() => setPrintSize(size)}
                            disabled={sizePrice == null}
                            className="h-4 w-4 accent-foreground"
                          />
                          <span className="flex flex-1 justify-between gap-2">
                            <span className="font-medium">{size}</span>
                            {sizePrice != null && (
                              <span>{formatPrice(sizePrice)}</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {printSize == null && (
                    <p className="text-xs text-muted-foreground">
                      Select A3 or A2 to continue.
                    </p>
                  )}
                </fieldset>
              )}
              {productType == null && (
                <p className="text-xs text-muted-foreground">
                  Select Digital or Print to continue.
                </p>
              )}
              <p className="rounded-md bg-muted px-3 py-2 text-sm">
                Total incl. 25% VAT:{" "}
                <span className="font-medium">
                  {price != null
                    ? formatPrice(price)
                    : productType === "print"
                      ? "Select a print size"
                      : "Select a format"}
                </span>
              </p>
              <div className="rounded-md border p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={isBusiness}
                    onChange={(event) => setIsBusiness(event.target.checked)}
                  />
                  I&apos;m ordering as a business
                </label>
                {isBusiness && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Swedish business orders include 25% VAT. Your company details
                    will be shown on the invoice.
                  </p>
                )}
              </div>
              {isBusiness && (
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="order-company-name">Company name</Label>
                    <Input id="order-company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="order-org-number">Organization number</Label>
                      <Input id="order-org-number" value={organizationNumber} onChange={(e) => setOrganizationNumber(e.target.value)} required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="order-vat-number">VAT number</Label>
                      <Input id="order-vat-number" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="SE123456789001" required />
                    </div>
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="order-name">Name</Label>
                <Input id="order-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="order-email">Email</Label>
                <Input id="order-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="order-phone">Phone (optional)</Label>
                <Input id="order-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+46 70 123 45 67" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="order-address">Address</Label>
                <Input id="order-address" value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
              <div className="grid grid-cols-[8rem_1fr] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="order-postal-code">Postcode</Label>
                  <Input id="order-postal-code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="123 45" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="order-city">City</Label>
                  <Input id="order-city" value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    productType == null ||
                    price == null ||
                    (productType === "print" && printSize == null)
                  }
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  Submit order request
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
