import { Resend } from "resend";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { createInvoicePdf } from "@/lib/server/invoice";
import type {
  CommerceSettings,
  OrderProductType,
  Photo,
  PhotoOrder,
  PrintSize,
} from "@/types/photo";

const orderSchema = z
  .object({
    photo_id: z.string().uuid(),
    product_type: z.enum(["digital", "print"]),
    print_size: z.enum(["A3", "A2"]).nullable(),
    is_business: z.boolean(),
    customer_company_name: z.string().trim().min(2).max(200).nullable(),
    customer_organization_number: z.string().trim().min(6).max(30).nullable(),
    customer_vat_number: z
      .string()
      .trim()
      .regex(/^SE\d{12}$/i, "Enter a Swedish VAT number")
      .nullable(),
    customer_name: z.string().trim().min(2).max(200),
    customer_email: z.string().trim().email().max(320),
    customer_phone: z
      .string()
      .trim()
      .regex(/^(?:\+46|0)[\d\s-]{6,20}$/, "Enter a Swedish phone number")
      .or(z.literal(""))
      .optional(),
    customer_address_line1: z.string().trim().min(3).max(200),
    customer_postal_code: z
      .string()
      .trim()
      .regex(/^\d{3}\s?\d{2}$/, "Enter a Swedish postcode"),
    customer_city: z.string().trim().min(2).max(100),
  })
  .superRefine((value, context) => {
    if (value.product_type === "digital" && value.print_size !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Digital orders cannot have a print size",
        path: ["print_size"],
      });
    }
    if (value.product_type === "print" && value.print_size === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select A3 or A2",
        path: ["print_size"],
      });
    }
    if (
      value.is_business &&
      (!value.customer_company_name ||
        !value.customer_organization_number ||
        !value.customer_vat_number)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter company name, organization number, and VAT number",
        path: ["customer_company_name"],
      });
    }
  });

function getSelectedPrice(
  photo: Photo,
  productType: OrderProductType,
  printSize: PrintSize | null
) {
  if (productType === "digital") return photo.digital_price;
  return printSize === "A3" ? photo.print_a3_price : photo.print_a2_price;
}

function settingsComplete(settings: CommerceSettings | null) {
  return Boolean(
    settings &&
      settings.legal_name &&
      settings.address_line1 &&
      settings.postal_code &&
      settings.city &&
      settings.organization_number &&
      settings.vat_number &&
      settings.notification_email &&
      settings.payment_instructions
  );
}

export async function POST(request: Request) {
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Check the order form details", 400);

  const admin = createAdminClient();
  const [{ data: photo, error: photoError }, { data: settings, error: settingsError }] =
    await Promise.all([
      admin.from("photos").select("*").eq("id", parsed.data.photo_id).maybeSingle(),
      admin.from("commerce_settings").select("*").eq("id", true).maybeSingle(),
    ]);
  if (photoError || settingsError) {
    return jsonError(photoError?.message || settingsError?.message || "Could not create order", 500);
  }

  const typedPhoto = photo as Photo | null;
  const typedSettings = settings as CommerceSettings | null;
  if (!typedPhoto) return jsonError("Photo not found", 404);
  if (!typedSettings || !settingsComplete(typedSettings)) {
    return jsonError("Ordering is not configured yet. Please contact the photographer.", 503);
  }

  const unitPrice = getSelectedPrice(
    typedPhoto,
    parsed.data.product_type,
    parsed.data.print_size
  );
  if (unitPrice == null) return jsonError("This product is not currently available", 409);

  const grossAmount = Number(unitPrice);
  const netAmount = Math.round((grossAmount / 1.25) * 100) / 100;
  const vatAmount = Math.round((grossAmount - netAmount) * 100) / 100;
  const sellerSnapshot = {
    legal_name: typedSettings.legal_name,
    address_line1: typedSettings.address_line1,
    postal_code: typedSettings.postal_code,
    city: typedSettings.city,
    organization_number: typedSettings.organization_number,
    vat_number: typedSettings.vat_number,
    payment_instructions: typedSettings.payment_instructions,
    payment_term_days: typedSettings.payment_term_days,
  };

  const { data: inserted, error: insertError } = await admin
    .from("orders")
    .insert({
      photo_id: typedPhoto.id,
      photo_title: typedPhoto.title,
      product_type: parsed.data.product_type,
      print_size: parsed.data.print_size,
      unit_price_incl_vat: grossAmount,
      net_amount: netAmount,
      vat_amount: vatAmount,
      gross_amount: grossAmount,
      is_business: parsed.data.is_business,
      customer_company_name: parsed.data.is_business
        ? parsed.data.customer_company_name
        : null,
      customer_organization_number: parsed.data.is_business
        ? parsed.data.customer_organization_number
        : null,
      customer_vat_number: parsed.data.is_business
        ? parsed.data.customer_vat_number?.toUpperCase() ?? null
        : null,
      customer_name: parsed.data.customer_name,
      customer_email: parsed.data.customer_email,
      customer_phone: parsed.data.customer_phone || null,
      customer_address_line1: parsed.data.customer_address_line1,
      customer_postal_code: parsed.data.customer_postal_code.replace(/\s/g, ""),
      customer_city: parsed.data.customer_city,
      seller_snapshot: sellerSnapshot,
    })
    .select("*")
    .single();
  if (insertError) return jsonError(insertError.message, 500);

  const order = inserted as PhotoOrder;
  try {
    const pdf = await createInvoicePdf({ order, settings: typedSettings });
    const invoicePath = `invoice-${order.invoice_number}.pdf`;
    const { error: storageError } = await admin.storage
      .from(STORAGE_BUCKETS.invoices)
      .upload(invoicePath, pdf, { contentType: "application/pdf", upsert: false });
    if (storageError) throw storageError;

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM_EMAIL;
    if (!resendApiKey || !resendFrom) {
      throw new Error("Invoice email is not configured");
    }
    const resend = new Resend(resendApiKey);
    const product = order.product_type === "digital"
      ? "Digital bild"
      : `Fotoprint ${order.print_size}`;
    const attachment = {
      filename: `faktura-${order.invoice_number}.pdf`,
      content: pdf,
    };
    const emailResults = await Promise.all([
      resend.emails.send({
        from: resendFrom,
        to: [order.customer_email],
        subject: `Faktura ${order.invoice_number} – ${typedSettings.legal_name}`,
        html: `
          <p>Tack för din beställning!</p>
          <p>Vänligen utför betalning till angivet bankgiro och ange fakturanumret i OCR.</p>
          <p>Vid frågor tveka inte att kontakta mig. Jag finns att nå på e-post <a href="mailto:brunnsv72@gmail.com">brunnsv72@gmail.com</a> eller telefon <a href="tel:+46701413007">0701413007</a>.</p>
          <p>Med vänlig hälsning,<br>Rickard Flodin</p>
        `,
        attachments: [attachment],
      }),
      resend.emails.send({
        from: resendFrom,
        to: [typedSettings.notification_email],
        subject: `Ny beställning ${order.invoice_number} – ${order.photo_title}`,
        html: `<p>Ny beställning: ${product} av “${order.photo_title}”.</p><p>Kund: ${order.customer_name}, ${order.customer_email}</p>`,
        attachments: [attachment],
      }),
    ]);
    const failedEmail = emailResults.find((result) => result.error);
    if (failedEmail?.error) throw new Error(failedEmail.error.message);

    await admin
      .from("orders")
      .update({
        invoice_path: invoicePath,
        invoice_email_status: "sent",
        emailed_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    return jsonOk({ invoice_number: order.invoice_number, email_sent: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invoice delivery failed";
    await admin
      .from("orders")
      .update({
        invoice_email_status: "failed",
        invoice_email_error: message.slice(0, 500),
      })
      .eq("id", order.id);
    console.error("Order invoice delivery failed", { orderId: order.id, message });
    return jsonOk({ invoice_number: order.invoice_number, email_sent: false }, { status: 201 });
  }
}
