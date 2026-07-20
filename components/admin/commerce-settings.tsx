"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiMutation } from "@/lib/api-client/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CommerceSettings } from "@/types/photo";

type FormValues = Omit<CommerceSettings, "id" | "updated_at">;

const emptyValues: FormValues = {
  legal_name: "",
  address_line1: "",
  postal_code: "",
  city: "",
  organization_number: "",
  vat_number: "",
  notification_email: "",
  payment_instructions: "",
  payment_term_days: 14,
};

export default function CommerceSettingsForm() {
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/commerce-settings")
      .then((response) => response.json())
      .then((result) => {
        if (result?.ok && result.data.settings) {
          const { id, updated_at, ...settings } = result.data.settings as CommerceSettings;
          setValues(settings);
        }
      })
      .catch(() => toast.error("Could not load invoice settings"))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await apiMutation("/api/commerce-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaving(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Invoice settings saved");
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading invoice settings…</p>;
  }

  return (
    <form className="space-y-4 text-left" onSubmit={save}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Invoice settings</h2>
        <p className="text-sm text-muted-foreground">
          Required to create Swedish VAT invoices and notify you of orders.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Legal name" value={values.legal_name} onChange={(value) => update("legal_name", value)} />
        <Field label="Organization number" value={values.organization_number} onChange={(value) => update("organization_number", value)} />
        <Field label="VAT number" value={values.vat_number} placeholder="SE123456789001" onChange={(value) => update("vat_number", value)} />
        <Field label="Order notification email" type="email" value={values.notification_email} onChange={(value) => update("notification_email", value)} />
        <Field label="Address" value={values.address_line1} onChange={(value) => update("address_line1", value)} />
        <Field label="Postcode" value={values.postal_code} placeholder="123 45" onChange={(value) => update("postal_code", value)} />
        <Field label="City" value={values.city} onChange={(value) => update("city", value)} />
        <div className="grid gap-2">
          <Label htmlFor="commerce-payment-terms">Payment terms (days)</Label>
          <Input
            id="commerce-payment-terms"
            type="number"
            min="1"
            max="90"
            value={values.payment_term_days}
            onChange={(event) =>
              update("payment_term_days", Number(event.target.value))
            }
            required
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="payment-instructions">Payment instructions</Label>
        <Textarea
          id="payment-instructions"
          value={values.payment_instructions}
          onChange={(event) => update("payment_instructions", event.target.value)}
          placeholder="Pay to Bankgiro 123-4567. State the invoice number as your reference."
          required
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}
        Save invoice settings
      </Button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = `commerce-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required />
    </div>
  );
}
