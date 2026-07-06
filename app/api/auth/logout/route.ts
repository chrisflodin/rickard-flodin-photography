import { jsonOk } from "@/lib/api-response";
import { createRequestClient } from "@/lib/server/backend/request-client";

export async function POST() {
  const client = await createRequestClient();
  await client.auth.signOut();

  return jsonOk({ ok: true });
}
