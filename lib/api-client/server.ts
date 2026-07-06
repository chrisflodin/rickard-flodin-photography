import "server-only";
import { headers } from "next/headers";

export async function serverApiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    throw new Error("Cannot resolve application host for API request");
  }

  const url = new URL(path, `${protocol}://${host}`);
  const cookie = requestHeaders.get("cookie");
  const forwardedHeaders = new Headers(init.headers);

  if (cookie && !forwardedHeaders.has("cookie")) {
    forwardedHeaders.set("cookie", cookie);
  }

  return fetch(url, {
    ...init,
    headers: forwardedHeaders,
    cache: "no-store",
  });
}
