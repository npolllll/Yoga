import type { MetadataRoute } from "next";
import { getCatalog, getPrograms } from "@/lib/data/public";
import { siteUrl } from "@/lib/supabase/env";

/** Bilingual sitemap with hreflang alternates for every public page. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [poses, programs] = await Promise.all([getCatalog(), getPrograms()]);
  const paths = [
    "",
    "/poses",
    "/programs",
    "/about",
    "/faq",
    "/contact",
    "/privacy",
    "/terms",
    ...poses.map((p) => `/poses/${p.slug}`),
    ...programs.map((p) => `/programs/${p.slug}`),
  ];
  return paths.flatMap((path) =>
    (["ru", "en"] as const).map((locale) => ({
      url: `${base}/${locale}${path}`,
      alternates: { languages: { ru: `${base}/ru${path}`, en: `${base}/en${path}` } },
    })),
  );
}
