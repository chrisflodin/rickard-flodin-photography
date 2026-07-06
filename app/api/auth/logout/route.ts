import { jsonOk } from "@/lib/api-response";
import { createClient } from "@/services/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return jsonOk({ ok: true });
}
