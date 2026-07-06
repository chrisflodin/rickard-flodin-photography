import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createRequestClient } from "@/lib/server/backend/request-client";
import { userIsAdmin } from "@/lib/server/backend/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid email or password", 400);

  const client = await createRequestClient();
  const { data, error } = await client.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return jsonError(error?.message ?? "Could not sign in", 401);
  }

  if (!userIsAdmin(data.user)) {
    await client.auth.signOut();
    return jsonError("Unauthorized", 401);
  }

  return jsonOk({
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
    },
  });
}
