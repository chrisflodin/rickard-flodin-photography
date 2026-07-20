"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/constants";
import type { Category } from "@/types/photo";

export default function Header({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const navigation = [
    ...categories.map((category) => ({
      label: category.name,
      href: `/categories/${category.slug}`,
    })),
    ...siteConfig.navigation,
  ];

  return (
    <header className="w-full border-b border-transparent">
      <div className="flex w-full items-center justify-between px-4 py-6 lg:px-[90px]">
        <Link href="/" className="text-lg tracking-tight">
          {siteConfig.title}
        </Link>

        <nav className="flex items-center gap-6 overflow-x-auto text-lg text-muted-foreground lg:gap-12 lg:text-[1.3rem]">
          {navigation.map((item) => {
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
