"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/constants";
import { useAdmin } from "@/components/admin/admin-provider";

export default function Header() {
  const pathname = usePathname();
  const isAdmin = useAdmin();

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
              "transition-colors hover:text-foreground",
              pathname.startsWith("/admin") && "text-foreground"
            )}
          >
            {isAdmin ? "Admin" : "Login"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
