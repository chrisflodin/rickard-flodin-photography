import { readJsonResult } from "@/lib/api-response";

export type MutationResult = { ok: true } | { ok: false; error: string };

export async function apiMutation<T = { ok: true }>(
  path: string,
  init: RequestInit
) {
  const response = await fetch(path, init);
  const result = await readJsonResult<T>(response);

  if (!response.ok && result.ok) {
    return { ok: false, error: response.statusText || "Request failed" };
  }

  return result;
}
