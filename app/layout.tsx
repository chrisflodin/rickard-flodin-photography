import type { Metadata } from "next";
import { Toaster } from "sonner";
import { getCanonicalUrl, getSiteUrl, siteConfig } from "@/lib/constants";
import { AdminProvider } from "@/components/admin/admin-provider";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { getAdminSession } from "@/lib/api-client/auth";
import { getCategories } from "@/lib/api-client/photos";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.title}`,
  },
  description: siteConfig.description,
  keywords: [
    "Rickard Flodin",
    "Rickard Flodin Photography",
    "photography portfolio",
    "fine art photography",
    "photographic prints",
  ],
  authors: [{ name: siteConfig.creator }],
  creator: siteConfig.creator,
  publisher: siteConfig.name,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: getCanonicalUrl("/"),
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ isAdmin }, categories] = await Promise.all([
    getAdminSession(),
    getCategories(),
  ]);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: siteConfig.name,
        url: siteUrl,
        description: siteConfig.description,
        publisher: {
          "@id": `${siteUrl}/#person`,
        },
      },
      {
        "@type": "Person",
        "@id": `${siteUrl}/#person`,
        name: siteConfig.creator,
        url: siteUrl,
        jobTitle: "Photographer",
      },
    ],
  };

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <AdminProvider isAdmin={isAdmin}>
          <div className="flex min-h-screen flex-col">
            <Header categories={categories} />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </AdminProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
