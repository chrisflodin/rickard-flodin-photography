"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/constants";
import type { Category } from "@/types/photo";

export default function Header({ categories }: { categories: Category[] }) {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-transparent">
      <div className="flex w-full items-center gap-6 px-4 py-6 lg:px-[90px]">
        <div className="flex min-w-0 flex-1 items-center gap-6 lg:gap-12">
          <Link href="/" className="shrink-0 text-lg tracking-tight">
            {siteConfig.title}
          </Link>
          <nav className="flex min-w-0 items-center gap-6 overflow-x-auto text-lg text-muted-foreground lg:gap-12 lg:text-[1.3rem]">
            {categories.map((category) => {
              const href = `/categories/${category.slug}`;
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={category.id}
                  href={href}
                  className={cn(
                    "shrink-0 transition-colors hover:text-foreground",
                    active && "text-foreground underline underline-offset-4"
                  )}
                >
                  {category.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <nav className="flex shrink-0 items-center gap-6 text-lg text-muted-foreground lg:gap-12 lg:text-[1.3rem]">
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
