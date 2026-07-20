import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
  return createPdf();

  async function createPdf() {
    const document = await PDFDocument.create();
    const page = document.addPage([595.28, 841.89]);
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const dark = rgb(0.08, 0.08, 0.08);
    const muted = rgb(0.35, 0.35, 0.35);
    const issuedAt = new Date(order.created_at);
    const dueAt = new Date(issuedAt);
    dueAt.setDate(dueAt.getDate() + settings.payment_term_days);
    const product =
      order.product_type === "digital"
        ? "Digital bild"
        : `Fotoprint ${order.print_size}`;

    const draw = (
      text: string,
      x: number,
      y: number,
      options: { size?: number; isBold?: boolean; color?: typeof dark } = {}
    ) =>
      page.drawText(text, {
        x,
        y,
        size: options.size ?? 10,
        font: options.isBold ? bold : regular,
        color: options.color ?? dark,
      });

    draw("FAKTURA", 440, 790, { size: 24, isBold: true });
    draw(`Fakturanummer: ${order.invoice_number}`, 54, 752);
    draw(`Fakturadatum: ${issuedAt.toLocaleDateString("sv-SE")}`, 54, 737);
    draw(`Förfallodatum: ${dueAt.toLocaleDateString("sv-SE")}`, 54, 722);

    draw("Säljare", 54, 680, { isBold: true });
    [
      settings.legal_name,
      settings.address_line1,
      `${settings.postal_code} ${settings.city}`,
      `Org.nr: ${settings.organization_number}`,
      `Momsreg.nr: ${settings.vat_number}`,
    ].forEach((line, index) => draw(line, 54, 664 - index * 15));

    draw("Köpare", 320, 680, { isBold: true });
    const buyerLines = [
      ...(order.is_business
        ? [
            order.customer_company_name ?? "",
            `Org.nr: ${order.customer_organization_number ?? ""}`,
            `Momsreg.nr: ${order.customer_vat_number ?? ""}`,
          ]
        : []),
      order.customer_name,
      order.customer_address_line1,
      `${order.customer_postal_code} ${order.customer_city}`,
      order.customer_email,
    ];
    buyerLines.forEach((line, index) => draw(line, 320, 664 - index * 15));

    const tableY = 540;
    draw("Beskrivning", 54, tableY, { isBold: true });
    draw("Exkl. moms", 305, tableY, { isBold: true });
    draw("Moms 25%", 405, tableY, { isBold: true });
    draw("Inkl. moms", 495, tableY, { isBold: true });
    page.drawLine({
      start: { x: 54, y: tableY - 8 },
      end: { x: 541, y: tableY - 8 },
      thickness: 0.8,
      color: muted,
    });
    draw(`${product}: ${order.photo_title}`, 54, tableY - 28);
    draw(formatPrice(order.net_amount), 305, tableY - 28);
    draw(formatPrice(order.vat_amount), 405, tableY - 28);
    draw(formatPrice(order.gross_amount), 495, tableY - 28);

    draw(`Att betala: ${formatPrice(order.gross_amount)}`, 375, 450, {
      size: 14,
      isBold: true,
    });
    wrapText(settings.payment_instructions, 80).forEach((line, index) =>
      draw(line, 54, 400 - index * 15)
    );
    draw("Priserna inkluderar 25 % moms.", 54, 340, { color: muted });

    return Buffer.from(await document.save());
  }
}

function wrapText(text: string, maxCharacters: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxCharacters && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
