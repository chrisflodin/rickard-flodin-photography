"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/constants";

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-transparent">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg tracking-tight">
          {siteConfig.title}
        </Link>

        <nav className="flex items-center gap-8 text-sm text-muted-foreground">
          {siteConfig.navigation.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground",
                  active && "text-foreground underline underline-offset-4"
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/admin"
            className={cn(
              "h-2 w-2 rounded-full bg-foreground transition-opacity hover:opacity-70",
              pathname.startsWith("/admin") && "opacity-70"
            )}
            aria-label="Admin"
          >
            <span className="sr-only">Admin</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
