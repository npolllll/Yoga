import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCatalog, getTaxonomy } from "@/lib/data/public";
import { toLibraryPose } from "@/lib/data/view";
import { t } from "@/lib/i18n/paths";
import { fmt } from "@/lib/i18n/format";
import { Library, type LibraryLabels } from "@/components/pose/Library";
import { PoseCard } from "@/components/pose/PoseCard";

export async function generateMetadata({ params }: PageProps<"/[locale]/poses">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.library.title,
    description: dict.library.text,
    alternates: { canonical: `/${locale}/poses`, languages: { ru: "/ru/poses", en: "/en/poses" } },
  };
}

export default async function PosesPage({ params }: PageProps<"/[locale]/poses">) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const [catalog, taxonomy] = await Promise.all([getCatalog(), getTaxonomy()]);
  const poses = catalog.map((p) => toLibraryPose(p, taxonomy.levels, locale));
  const labels: LibraryLabels = {
    ...dict.library,
    close: dict.common.close,
    favorite: { add: dict.actions.favorite, remove: dict.actions.removeFavorite, added: dict.actions.favorited },
    levelAria: dict.levels.dotsLabel,
  };
  const sorted = [...poses].sort((a, b) => a.sortWeight - b.sortWeight);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
      <header className="max-w-2xl">
        <h1 className="text-4xl sm:text-5xl">{dict.library.title}</h1>
        <p className="mt-3 text-muted">{dict.library.text}</p>
      </header>
      <div className="mt-8">
        <Suspense
          fallback={
            // Static shell without JavaScript filters: the full catalog, crawlable and usable.
            <>
              <p className="font-semibold">{fmt(dict.library.found, { n: sorted.length })}</p>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
                {sorted.map((p, i) => (
                  <li key={p.id}>
                    <PoseCard
                      pose={p}
                      href={`/${locale}/poses/${p.slug}`}
                      priority={i < 4}
                      favoriteLabels={labels.favorite}
                      levelAria={fmt(labels.levelAria, { level: p.levelLabel })}
                    />
                  </li>
                ))}
              </ul>
            </>
          }
        >
          <Library
            locale={locale}
            poses={poses}
            levels={taxonomy.levels.map((l) => ({ key: l.key, label: t(l.label, locale) }))}
            categories={taxonomy.categories.map((c) => ({ key: c.key, label: t(c.name, locale) }))}
            skills={taxonomy.skills.map((s) => ({ key: s.key, label: t(s.name, locale) }))}
            quickSkills={taxonomy.skills.filter((s) => s.quickFilter).map((s) => s.key)}
            labels={labels}
          />
        </Suspense>
      </div>
    </div>
  );
}
