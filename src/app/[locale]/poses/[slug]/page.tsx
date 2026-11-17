import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getCatalog, getExercises, getPose, getPrograms, getTaxonomy } from "@/lib/data/public";
import { t } from "@/lib/i18n/paths";
import { mediaUrl } from "@/lib/media";
import { PoseView } from "@/components/pose/PoseView";

// Known slugs are prerendered at build time; slugs published later render on demand (allowed to block).
export const instant = false;

export async function generateStaticParams() {
  const catalog = await getCatalog();
  // Cache Components requires at least one param; unknown slugs render on demand.
  return catalog.length > 0 ? catalog.map((p) => ({ slug: p.slug })) : [{ slug: "bakasana" }];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/poses/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const pose = await getPose(slug);
  if (!pose) return {};
  const title = pose.doc.seo?.title?.[locale] || `${t(pose.name, locale)}${pose.sanskrit ? ` (${pose.sanskrit})` : ""}`;
  const description = pose.doc.seo?.description?.[locale] || t(pose.summary, locale);
  const image = pose.media.poster ? mediaUrl(pose.media.poster.url) : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/${locale}/poses/${slug}`, languages: { ru: `/ru/poses/${slug}`, en: `/en/poses/${slug}` } },
    openGraph: { title, description, images: image ? [image] : undefined, type: "article" },
  };
}

export default async function PosePage({ params }: PageProps<"/[locale]/poses/[slug]">) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const [pose, taxonomy, catalog, exercises, programs] = await Promise.all([
    getPose(slug),
    getTaxonomy(),
    getCatalog(),
    getExercises(),
    getPrograms(),
  ]);
  if (!pose) notFound();
  return <PoseView locale={locale} pose={pose} taxonomy={taxonomy} catalog={catalog} exercises={exercises} programs={programs} />;
}
