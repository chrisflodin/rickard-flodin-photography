import { jsonOk } from "@/lib/api-response";
import { getAdminStatus } from "@/services/supabase/auth";

export async function GET() {
  const { isAdmin, user } = await getAdminStatus();

  return jsonOk({
    isAdmin,
    user: user
      ? {
          id: user.id,
          email: user.email ?? null,
        }
      : null,
  });
}
