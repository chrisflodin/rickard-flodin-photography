import { NextResponse } from "next/server";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: string };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init);
}

export function jsonError(error: string, status = 400) {
  return NextResponse.json<ApiFailure>({ ok: false, error }, { status });
}

export async function readJsonResult<T>(response: Response): Promise<ApiResult<T>> {
  const payload = (await response.json().catch(() => null)) as ApiResult<T> | null;
  if (payload?.ok) return payload;

  return {
    ok: false,
    error:
      payload && "error" in payload && payload.error
        ? payload.error
        : response.statusText || "Request failed",
  };
}
