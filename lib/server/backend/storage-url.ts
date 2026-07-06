import "server-only";

/**
 * Build a public URL for an object in the configured image storage backend.
 */
export function getPublicUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
