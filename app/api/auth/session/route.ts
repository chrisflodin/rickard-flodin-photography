import { jsonOk } from "@/lib/api-response";
import { getAdminStatus } from "@/lib/server/backend/auth";

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
