/**
 * Build a public URL for an object in a public Supabase Storage bucket.
 * Avoids needing a client instance for simple public reads.
 */
export function getPublicUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
