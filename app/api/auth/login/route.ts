import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createClient } from "@/services/supabase/server";
import { userIsAdmin } from "@/services/supabase/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid email or password", 400);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return jsonError(error?.message ?? "Could not sign in", 401);
  }

  if (!userIsAdmin(data.user)) {
    await supabase.auth.signOut();
    return jsonError("Unauthorized", 401);
  }

  return jsonOk({
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
    },
  });
}
