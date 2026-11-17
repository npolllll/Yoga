import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPrograms, getTaxonomy } from "@/lib/data/public";
import { t } from "@/lib/i18n/paths";
import { fmt } from "@/lib/i18n/format";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/program/ProgramProgress";

export async function generateMetadata({ params }: PageProps<"/[locale]/programs">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.programs.title, description: dict.programs.text, alternates: { canonical: `/${locale}/programs`, languages: { ru: "/ru/programs", en: "/en/programs" } } };
}

export default async function ProgramsPage({ params }: PageProps<"/[locale]/programs">) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const [programs, taxonomy] = await Promise.all([getPrograms(), getTaxonomy()]);
  const levelOrder = Object.fromEntries(taxonomy.levels.map((l) => [l.key, l.rank]));
  const sorted = [...programs].sort((a, b) => (levelOrder[a.levelKey] ?? 9) - (levelOrder[b.levelKey] ?? 9) || a.sortWeight - b.sortWeight);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
      <header className="max-w-2xl">
        <h1 className="text-4xl sm:text-5xl">{dict.programs.title}</h1>
        <p className="mt-3 text-muted">{dict.programs.text}</p>
      </header>
      {sorted.length === 0 ? (
        <p className="mt-10 text-muted">{dict.programs.empty}</p>
      ) : (
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {sorted.map((p) => {
            const level = taxonomy.levels.find((l) => l.key === p.levelKey);
            return (
              <li key={p.id} className="flex flex-col rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  {level ? <LevelBadge rank={level.rank} label={t(level.label, locale)} ariaLabel={fmt(dict.levels.dotsLabel, { level: t(level.label, locale) })} /> : <span />}
                  <span className="text-sm text-muted">{fmt(dict.programs.steps, { n: p.doc.steps.length })}</span>
                </div>
                <h2 className="mt-4 text-2xl">
                  <Link href={`/${locale}/programs/${p.slug}`} className="hover:text-brand">
                    {t(p.doc.title, locale)}
                  </Link>
                </h2>
                <p className="mt-2 flex-1 text-muted">{t(p.doc.summary, locale)}</p>
                <div className="mt-5">
                  <ProgressBar programId={p.id} stepKeys={p.doc.steps.map((s) => s.key)} labels={{ progress: dict.programs.progress }} />
                </div>
                <Link href={`/${locale}/programs/${p.slug}`} className="mt-5 inline-flex w-max items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold hover:bg-primary-hover">
                  {dict.programs.start}
                  <Icon name="arrowRight" size={16} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
