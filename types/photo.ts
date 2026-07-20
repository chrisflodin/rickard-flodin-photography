export interface Photo {
  id: string;
  category_id: string;
  title: string;
  description: string;
  digital_price: number | null;
  print_a3_price: number | null;
  print_a2_price: number | null;
  storage_path: string;
  image_url?: string;
  width: number;
  height: number;
  blur_data_url: string | null;
  sort_order: number;
  column_index: number;
  column_order: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  featured_photo_id: string | null;
  featured_photo: Pick<
    Photo,
    "id" | "storage_path" | "image_url" | "width" | "height" | "blur_data_url"
  > | null;
  created_at: string;
}

export interface GallerySettings {
  columns_count: number;
}

export interface PhotoPosition {
  id: string;
  column_index: number;
  column_order: number;
}

export interface About {
  id: boolean;
  body: string;
  photographer_image_path: string | null;
  photographer_image_url?: string | null;
  updated_at: string;
}

export interface CommerceSettings {
  id: boolean;
  legal_name: string;
  address_line1: string;
  postal_code: string;
  city: string;
  organization_number: string;
  vat_number: string;
  notification_email: string;
  payment_instructions: string;
  payment_term_days: number;
  updated_at: string;
}

export type OrderProductType = "digital" | "print";
export type PrintSize = "A3" | "A2";

export interface PhotoOrder {
  id: string;
  invoice_number: number;
  photo_id: string | null;
  photo_title: string;
  product_type: OrderProductType;
  print_size: PrintSize | null;
  unit_price_incl_vat: number;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  gross_amount: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address_line1: string;
  customer_postal_code: string;
  customer_city: string;
  invoice_path: string | null;
  invoice_email_status: "pending" | "sent" | "failed";
  invoice_email_error: string | null;
  created_at: string;
  emailed_at: string | null;
}

export type PhotoUpdate = Partial<
  Pick<
    Photo,
    "title" | "description" | "digital_price" | "print_a3_price" | "print_a2_price"
  >
>;
