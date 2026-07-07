import { siteConfig } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="w-full">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col items-center justify-between gap-2 px-6 py-10 text-xs text-muted-foreground sm:flex-row">
        <p>
          &copy; {new Date().getFullYear()} {siteConfig.title}
        </p>
        <p>All images are the property of the photographer.</p>
      </div>
    </footer>
  );
}
