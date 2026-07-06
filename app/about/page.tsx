import type { Metadata } from "next";
import { getAbout } from "@/services/api/photos";
import AboutContent from "@/components/about/about-content";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "About",
};

export default async function AboutPage() {
  const about = await getAbout();

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-12">
      <AboutContent about={about} />
    </div>
  );
}
