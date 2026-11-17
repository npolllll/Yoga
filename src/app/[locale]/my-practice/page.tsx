import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCatalog, getPrograms, getTaxonomy } from "@/lib/data/public";
import { toLibraryPose } from "@/lib/data/view";
import { t } from "@/lib/i18n/paths";
import { PracticeDashboard } from "@/components/practice/PracticeDashboard";

export async function generateMetadata({ params }: PageProps<"/[locale]/my-practice">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).practice.title, robots: { index: false } } : {};
}

export default async function MyPracticePage({ params }: PageProps<"/[locale]/my-practice">) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const [catalog, programs, taxonomy] = await Promise.all([getCatalog(), getPrograms(), getTaxonomy()]);
  const poses = catalog.map((p) => toLibraryPose(p, taxonomy.levels, locale)).map(({ id, slug, name, secondary, levelRank, levelLabel, card }) => ({ id, slug, name, secondary, levelRank, levelLabel, card }));
  const programRows = programs.map((p) => ({ id: p.id, slug: p.slug, title: t(p.doc.title, locale), stepKeys: p.doc.steps.map((s) => s.key) }));
  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
      <h1 className="text-4xl sm:text-5xl">{dict.practice.title}</h1>
      <Suspense fallback={<div className="skeleton mt-8 h-12 max-w-xl rounded-full" />}>
        <PracticeDashboard
          locale={locale}
          poses={poses}
          programs={programRows}
          dict={{ practice: dict.practice, actions: dict.actions, programs: dict.programs, common: dict.common, levelAria: dict.levels.dotsLabel, auth: { login: dict.auth.login, signup: dict.auth.signup } }}
        />
      </Suspense>
    </div>
  );
}
