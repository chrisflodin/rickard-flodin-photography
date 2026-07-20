import "server-only";

import PDFDocument from "pdfkit";
import { formatPrice } from "@/lib/utils";
import type { CommerceSettings, PhotoOrder } from "@/types/photo";

export function createInvoicePdf({
  order,
  settings,
}: {
  order: Pick<
    PhotoOrder,
    | "invoice_number"
    | "photo_title"
    | "product_type"
    | "print_size"
    | "unit_price_incl_vat"
    | "net_amount"
    | "vat_amount"
    | "gross_amount"
    | "is_business"
    | "customer_company_name"
    | "customer_organization_number"
    | "customer_vat_number"
    | "customer_name"
    | "customer_email"
    | "customer_address_line1"
    | "customer_postal_code"
    | "customer_city"
    | "created_at"
  >;
  settings: CommerceSettings;
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ margin: 54, size: "A4" });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    const issuedAt = new Date(order.created_at);
    const dueAt = new Date(issuedAt);
    dueAt.setDate(dueAt.getDate() + settings.payment_term_days);
    const product =
      order.product_type === "digital"
        ? "Digital bild"
        : `Fotoprint ${order.print_size}`;

    document.fontSize(24).text("FAKTURA", { align: "right" });
    document.moveDown();
    document.fontSize(10);
    document.text(`Fakturanummer: ${order.invoice_number}`);
    document.text(`Fakturadatum: ${issuedAt.toLocaleDateString("sv-SE")}`);
    document.text(`Förfallodatum: ${dueAt.toLocaleDateString("sv-SE")}`);
    document.moveDown(2);

    const top = document.y;
    document.font("Helvetica-Bold").text("Säljare", 54, top);
    document.font("Helvetica").text(settings.legal_name);
    document.text(settings.address_line1);
    document.text(`${settings.postal_code} ${settings.city}`);
    document.text(`Org.nr: ${settings.organization_number}`);
    document.text(`Momsreg.nr: ${settings.vat_number}`);

    document.font("Helvetica-Bold").text("Köpare", 320, top);
    document.font("Helvetica");
    if (order.is_business) {
      document.text(order.customer_company_name ?? "", 320);
      document.text(`Org.nr: ${order.customer_organization_number ?? ""}`, 320);
      document.text(`Momsreg.nr: ${order.customer_vat_number ?? ""}`, 320);
    }
    document.text(order.customer_name, 320);
    document.text(order.customer_address_line1, 320);
    document.text(`${order.customer_postal_code} ${order.customer_city}`, 320);
    document.text(order.customer_email, 320);
    document.moveDown(4);

    document.font("Helvetica-Bold").text("Beskrivning", 54);
    document.text("Pris exkl. moms", 300, document.y - 12);
    document.text("Moms 25%", 410, document.y - 12);
    document.text("Pris inkl. moms", 490, document.y - 12, { width: 70, align: "right" });
    document.moveTo(54, document.y + 4).lineTo(541, document.y + 4).stroke();
    document.moveDown();
    document.font("Helvetica").text(`${product}: ${order.photo_title}`, 54);
    document.text(formatPrice(order.net_amount), 300, document.y - 12);
    document.text(formatPrice(order.vat_amount), 410, document.y - 12);
    document.text(formatPrice(order.gross_amount), 490, document.y - 12, {
      width: 70,
      align: "right",
    });
    document.moveDown(3);

    document.font("Helvetica-Bold").text(
      `Att betala: ${formatPrice(order.gross_amount)}`,
      { align: "right" }
    );
    document.moveDown(2);
    document.font("Helvetica").fontSize(10).text(settings.payment_instructions);
    document.moveDown();
    document.text("Priserna inkluderar 25 % moms.");
    document.end();
  });
}
