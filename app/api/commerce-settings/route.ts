import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";
import type { CommerceSettings } from "@/types/photo";

const settingsSchema = z.object({
  legal_name: z.string().trim().min(1).max(200),
  address_line1: z.string().trim().min(1).max(200),
  postal_code: z.string().trim().regex(/^\d{3}\s?\d{2}$/),
  city: z.string().trim().min(1).max(100),
  organization_number: z.string().trim().min(1).max(30),
  vat_number: z.string().trim().regex(/^SE\d{12}$/i),
  notification_email: z.string().trim().email().max(320),
  payment_instructions: z.string().trim().min(1).max(2000),
  payment_term_days: z.number().int().min(1).max(90),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("commerce_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  return jsonOk({ settings: data as CommerceSettings | null });
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Check the invoice settings", 400);

  const admin = createAdminClient();
  const { error } = await admin
    .from("commerce_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true });
}
