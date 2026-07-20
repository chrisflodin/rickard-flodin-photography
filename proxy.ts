import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // If env is not configured yet, don't block rendering.
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh the session so Server Components see a valid token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect admin-only API write routes.
  const pathname = request.nextUrl.pathname;
  const isProtectedApi =
    pathname.startsWith("/api/photos") ||
    pathname.startsWith("/api/categories") ||
    pathname.startsWith("/api/commerce-settings") ||
    pathname.startsWith("/api/about") ||
    pathname.startsWith("/api/gallery-settings");
  const isMutating = request.method !== "GET" && request.method !== "HEAD";

  if (isProtectedApi && isMutating && !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
