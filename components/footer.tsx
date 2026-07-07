import { siteConfig } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="w-full">
      <div className="flex w-full flex-col items-center justify-between gap-2 px-4 py-10 text-xs text-muted-foreground sm:flex-row">
        <p>
          &copy; {new Date().getFullYear()} {siteConfig.title}
        </p>
        <p>All images are the property of the photographer.</p>
      </div>
    </footer>
  );
}
