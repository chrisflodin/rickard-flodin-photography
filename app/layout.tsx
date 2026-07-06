import type { Metadata } from "next";
import { Toaster } from "sonner";
import { siteConfig } from "@/lib/constants";
import { AdminProvider } from "@/components/admin/admin-provider";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { getAdminSession } from "@/services/api/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.title}`,
  },
  description: siteConfig.description,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin } = await getAdminSession();

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <AdminProvider isAdmin={isAdmin}>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </AdminProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
