"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { readJsonResult } from "@/lib/api-response";
import { Button } from "@/components/ui/button";
import type { PhotoOrder } from "@/types/photo";

type OrderRow = Pick<
  PhotoOrder,
  | "id"
  | "invoice_number"
  | "photo_title"
  | "product_type"
  | "print_size"
  | "gross_amount"
  | "customer_name"
  | "customer_email"
  | "customer_phone"
  | "invoice_path"
  | "invoice_email_status"
  | "created_at"
>;

interface OrdersResponse {
  orders: OrderRow[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

const PAGE_SIZE = 10;

const currencyFormatter = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
});

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const statusLabels: Record<PhotoOrder["invoice_email_status"], string> = {
  pending: "Väntar",
  sent: "Skickad",
  failed: "Misslyckad",
};

export default function OrdersTable() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrders() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/orders?page=${page}&page_size=${PAGE_SIZE}`,
          { cache: "no-store", signal: controller.signal }
        );
        const result = await readJsonResult<OrdersResponse>(response);
        if (!result.ok) throw new Error(result.error);

        setOrders(result.data.orders);
        setTotal(result.data.pagination.total);
        setTotalPages(result.data.pagination.total_pages);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Beställningarna kunde inte läsas in"
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadOrders();
    return () => controller.abort();
  }, [page, reloadKey]);

  return (
    <section className="space-y-4 text-left">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Beställningar</h2>
        <p className="text-sm text-muted-foreground">
          Alla genomförda beställningar och deras fakturor.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Datum</th>
              <th className="px-3 py-2 font-medium">Fakturanr</th>
              <th className="px-3 py-2 font-medium">Kund</th>
              <th className="px-3 py-2 font-medium">Bild</th>
              <th className="px-3 py-2 font-medium">Format</th>
              <th className="px-3 py-2 text-right font-medium">Belopp</th>
              <th className="px-3 py-2 font-medium">E-poststatus</th>
              <th className="px-3 py-2 font-medium">Faktura</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Laddar beställningar…
                  </span>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center">
                  <p className="mb-3 text-destructive">{error}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReloadKey((current) => current + 1)}
                  >
                    Försök igen
                  </Button>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Inga beställningar ännu.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-3">
                    {dateFormatter.format(new Date(order.created_at))}
                  </td>
                  <td className="px-3 py-3 font-medium">{order.invoice_number}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{order.customer_name}</div>
                    <a
                      className="block text-xs text-muted-foreground hover:underline"
                      href={`mailto:${order.customer_email}`}
                    >
                      {order.customer_email}
                    </a>
                    <a
                      className="block text-xs text-muted-foreground hover:underline"
                      href={`tel:${order.customer_phone}`}
                    >
                      {order.customer_phone}
                    </a>
                  </td>
                  <td className="max-w-48 px-3 py-3">{order.photo_title}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {order.product_type === "digital"
                      ? "Digital"
                      : `Print ${order.print_size}`}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-medium">
                    {currencyFormatter.format(Number(order.gross_amount))}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        order.invoice_email_status === "sent"
                          ? "text-emerald-700"
                          : order.invoice_email_status === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {statusLabels[order.invoice_email_status]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {order.invoice_path ? (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`/api/orders/${order.id}/invoice`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText />
                          Visa
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Saknas</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {total} {total === 1 ? "beställning" : "beställningar"}
        </span>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Föregående
          </Button>
          <span>
            Sida {page} av {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Nästa
          </Button>
        </div>
      </div>
    </section>
  );
}
