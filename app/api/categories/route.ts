import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createAdminClient } from "@/lib/server/backend/admin-client";
import { requireAdmin } from "@/lib/server/backend/auth";
import { getCategories } from "@/lib/server/backend/content";
import { getPublicUrl } from "@/lib/server/backend/storage-url";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { Category } from "@/types/photo";

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function withImageUrl(category: Category) {
  return {
    ...category,
    featured_photo: category.featured_photo
      ? {
          ...category.featured_photo,
          image_url: getPublicUrl(
            STORAGE_BUCKETS.photos,
            category.featured_photo.storage_path
          ),
        }
      : null,
  };
}

function revalidateCategories(slug?: string) {
  revalidatePath("/");
  if (slug) revalidatePath(`/categories/${slug}`);
}

export async function GET() {
  const categories = await getCategories();
  return jsonOk({ categories: categories.map(withImageUrl) });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const parsed = createCategorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid category name", 400);

  const baseSlug = slugify(parsed.data.name);
  if (!baseSlug) return jsonError("Category name must contain letters or numbers", 400);

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("categories")
    .select("slug, sort_order")
    .order("sort_order", { ascending: false });
  if (existingError) return jsonError(existingError.message, 500);

  const usedSlugs = new Set((existing ?? []).map((category) => category.slug));
  let slug = baseSlug;
  let suffix = 2;
  while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;

  const nextSortOrder =
    Math.max(-1, ...(existing ?? []).map((category) => category.sort_order)) + 1;
  const { data, error } = await admin
    .from("categories")
    .insert({ name: parsed.data.name, slug, sort_order: nextSortOrder })
    .select("*")
    .single();
  if (error) return jsonError(error.message, 500);

  revalidateCategories();
  return jsonOk(
    {
      category: {
        ...(data as Omit<Category, "featured_photo">),
        featured_photo: null,
      },
    },
    { status: 201 }
  );
}
