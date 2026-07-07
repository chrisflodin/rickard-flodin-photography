import type { Metadata } from "next";
import { getAbout } from "@/lib/api-client/photos";
import AboutContent from "@/components/about/about-content";
import { getCanonicalUrl, siteConfig } from "@/lib/constants";

export const revalidate = 0;

const description =
  "Learn more about Rickard Flodin and the photography behind the portfolio.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    type: "profile",
    url: getCanonicalUrl("/about"),
    title: `About ${siteConfig.creator}`,
    description,
  },
  twitter: {
    card: "summary",
    title: `About ${siteConfig.creator}`,
    description,
  },
};

export default async function AboutPage() {
  const about = await getAbout();

  return (
    <div className="w-full px-4 py-12">
      <AboutContent about={about} />
    </div>
  );
}
