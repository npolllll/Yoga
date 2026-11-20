import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getProgramView, getPrograms } from "@/lib/data/public";
import { t } from "@/lib/i18n/paths";
import { fmt } from "@/lib/i18n/format";
import { Icon } from "@/components/ui/Icon";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { RichText } from "@/components/ui/RichText";
import { ContinueButton, ProgressBar, StepList, type StepRow } from "@/components/program/ProgramProgress";

// Known slugs are prerendered at build time; slugs published later render on demand (allowed to block).
export const instant = false;

export async function generateStaticParams() {
  const programs = await getPrograms();
  return programs.length > 0 ? programs.map((p) => ({ slug: p.slug })) : [{ slug: "beginner" }];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/programs/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const p = (await getProgramView(slug)).program;
  if (!p) return {};
  return {
    title: t(p.doc.title, locale),
    description: t(p.doc.summary, locale),
    alternates: { canonical: `/${locale}/programs/${slug}`, languages: { ru: `/ru/programs/${slug}`, en: `/en/programs/${slug}` } },
  };
}

export default async function ProgramPage({ params }: PageProps<"/[locale]/programs/[slug]">) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const { program, taxonomy, catalog, exercises } = await getProgramView(slug);
  if (!program) notFound();
  const dict = getDictionary(locale);
  const d = program.doc;
  const level = taxonomy.levels.find((l) => l.key === program.levelKey);
  const poseById = new Map(catalog.map((p) => [p.id, p]));
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const rows: StepRow[] = d.steps.map((s) => {
    const fallback = s.kind === "pose" && s.poseId ? poseById.get(s.poseId)?.name : s.kind === "exercise" && s.exerciseId ? exById.get(s.exerciseId)?.doc.name : undefined;
    return {
      key: s.key,
      kind: s.kind,
      title: t(s.title, locale) || t(fallback, locale),
      kindLabel: dict.programs.kind[s.kind],
      poseId: s.poseId,
    };
  });
  const base = `/${locale}/programs/${program.slug}`;
  const stepKeys = d.steps.map((s) => s.key);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-8 pt-6 sm:px-6" data-testid="program-page" data-program-id={program.id}>
      <Link href={`/${locale}/programs`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={16} />
        {dict.programs.title}
      </Link>
      <header className="mt-4">
        {level ? <LevelBadge rank={level.rank} label={t(level.label, locale)} ariaLabel={fmt(dict.levels.dotsLabel, { level: t(level.label, locale) })} /> : null}
        <h1 className="mt-3 text-4xl sm:text-5xl">{t(d.title, locale)}</h1>
        <p className="mt-3 text-lg text-muted">{t(d.summary, locale)}</p>
      </header>

      {!program.expertApproved ? (
        <p className="mt-6 flex gap-3 rounded-[var(--radius-md)] bg-warning-soft p-4 text-sm text-warning" role="note">
          <Icon name="info" className="shrink-0" />
          {dict.common.unreviewedNotice}
        </p>
      ) : null}

      <div className="mt-8 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6">
        <ProgressBar programId={program.id} stepKeys={stepKeys} labels={{ progress: dict.programs.progress }} />
        <div className="mt-4">
          <ContinueButton programId={program.id} stepKeys={stepKeys} baseHref={base} labels={{ start: dict.programs.start, continueFrom: dict.programs.continueFrom, completed: dict.programs.completed }} />
        </div>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-2xl">{dict.programs.audience}</h2>
          <RichText text={t(d.audience, locale)} className="mt-3 text-muted" />
          <div className="mt-4">
            <RichText text={t(d.description, locale)} />
          </div>
        </section>
        <div className="space-y-8">
          {d.prerequisites.length > 0 ? (
            <section>
              <h2 className="text-2xl">{dict.programs.prerequisites}</h2>
              <ul className="mt-3 space-y-2">
                {d.prerequisites.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <Icon name="check" className="mt-0.5 shrink-0 text-success" />
                    {t(p, locale)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {d.goals.length > 0 ? (
            <section>
              <h2 className="text-2xl">{dict.programs.goals}</h2>
              <ul className="mt-3 space-y-2">
                {d.goals.map((g, i) => (
                  <li key={i} className="flex gap-2">
                    <Icon name="target" className="mt-0.5 shrink-0 text-brand" />
                    {t(g, locale)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {d.safety.length > 0 ? (
        <ul className="mt-8 space-y-2 rounded-[var(--radius-md)] border border-line bg-surface-2 p-5 text-sm">
          {d.safety.map((s, i) => (
            <li key={i} className="flex gap-3">
              <Icon name="alert" className="mt-0.5 shrink-0 text-mauve" />
              {t(s, locale)}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="mt-10">
        <h2 className="text-2xl">{dict.programs.stepsTitle}</h2>
        <div className="mt-4">
          <StepList programId={program.id} steps={rows} baseHref={base} labels={{ done: dict.actions.stepDone, learned: dict.actions.learned }} />
        </div>
      </section>
    </div>
  );
}
