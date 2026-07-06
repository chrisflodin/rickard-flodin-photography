import "server-only";
import { readJsonResult } from "@/lib/api-response";
import { serverApiFetch } from "@/services/api/server";

export interface AdminSession {
  isAdmin: boolean;
  user: { id: string; email: string | null } | null;
}

export async function getAdminSession(): Promise<AdminSession> {
  const response = await serverApiFetch("/api/auth/session");
  const result = await readJsonResult<AdminSession>(response);

  return result.ok ? result.data : { isAdmin: false, user: null };
}
