import "server-only";
import type { User } from "@supabase/supabase-js";
import { createRequestClient } from "@/lib/server/backend/request-client";

export function userIsAdmin(user: User | null): boolean {
  return Boolean(user);
}

export async function getAdminStatus(): Promise<{
  isAdmin: boolean;
  user: User | null;
}> {
  try {
    const client = await createRequestClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    return { isAdmin: userIsAdmin(user), user };
  } catch {
    return { isAdmin: false, user: null };
  }
}

export async function requireAdmin(): Promise<User> {
  const { isAdmin, user } = await getAdminStatus();
  if (!isAdmin || !user) {
    throw new Error("Unauthorized");
  }
  return user;
}
