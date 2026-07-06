import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/services/supabase/server";

/**
 * An authenticated user is treated as admin. If ADMIN_EMAIL is set, the user's
 * email must match it as well.
 */
export function userIsAdmin(user: User | null): boolean {
  if (!user) return false;
  const allowed = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowed) return true;
  return user.email?.toLowerCase() === allowed;
}

/**
 * Resolve the current admin status from the request session.
 * Safe to call in Server Components and layouts.
 */
export async function getAdminStatus(): Promise<{
  isAdmin: boolean;
  user: User | null;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { isAdmin: userIsAdmin(user), user };
  } catch {
    return { isAdmin: false, user: null };
  }
}

/**
 * Throws when the caller is not an admin. Use to guard server actions /
 * route handlers before performing writes.
 */
export async function requireAdmin(): Promise<User> {
  const { isAdmin, user } = await getAdminStatus();
  if (!isAdmin || !user) {
    throw new Error("Unauthorized");
  }
  return user;
}
