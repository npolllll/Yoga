import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPrograms, getStepView } from "@/lib/data/public";
import { t } from "@/lib/i18n/paths";
import { fmt } from "@/lib/i18n/format";
import { mediaUrl, providerLabel } from "@/lib/media";
import { Icon } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { StepCompleteButton, ProgressBar } from "@/components/program/ProgramProgress";
import { StatusControl } from "@/components/pose/PoseActions";
import { PoseImage } from "@/components/pose/PoseCard";
import { VideoLesson } from "@/components/pose/VideoLesson";

// Known slugs are prerendered at build time; slugs published later render on demand (allowed to block).
export const instant = false;

export async function generateStaticParams() {
  const programs = await getPrograms();
  const params = programs.flatMap((p) => p.doc.steps.map((s) => ({ slug: p.slug, stepKey: s.key })));
  return params.length > 0 ? params : [{ slug: "beginner", stepKey: "00000000-0000-4000-8000-000000000000" }];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/programs/[slug]/steps/[stepKey]">): Promise<Metadata> {
  const { locale, slug, stepKey } = await params;
  if (!isLocale(locale)) return {};
  const { program } = await getStepView(slug, stepKey);
  const step = program?.doc.steps.find((s) => s.key === stepKey);
  // A removed step shows an explanation page: never index it.
  if (!program || !step) return { robots: { index: false, follow: true } };
  return {
    title: `${t(step.title, locale)} · ${t(program.doc.title, locale)}`,
    alternates: {
      canonical: `/${locale}/programs/${slug}/steps/${stepKey}`,
      languages: { ru: `/ru/programs/${slug}/steps/${stepKey}`, en: `/en/programs/${slug}/steps/${stepKey}` },
    },
  };
}

export default async function StepPage({ params }: PageProps<"/[locale]/programs/[slug]/steps/[stepKey]">) {
  const { locale: raw, slug, stepKey } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const view = await getStepView(slug, stepKey);
  const program = view.program;
  if (!program) notFound();
  const index = program.doc.steps.findIndex((s) => s.key === stepKey);
  const base = `/${locale}/programs/${program.slug}`;
  if (index === -1) {
    // A removed step: explain instead of a bare 404 (old links keep working gracefully).
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-lg">{dict.programs.stepNotFound}</p>
        <Link href={base} className="mt-6 inline-block font-semibold text-brand hover:underline">
          {dict.programs.backToProgram}
        </Link>
      </div>
    );
  }
  const step = program.doc.steps[index];
  const prev = program.doc.steps[index - 1];
  const next = program.doc.steps[index + 1];
  const { exercises, pose } = view;
  const exercise = step.kind === "exercise" && step.exerciseId ? exercises.find((e) => e.id === step.exerciseId) : undefined;
  const title = t(step.title, locale) || t(pose?.name ?? exercise?.doc.name, locale);
  const video = step.video?.[locale] ?? (pose ? pose.doc.video[locale] : null) ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:px-6" data-testid="step-page" data-step-key={step.key}>
      <Link href={base} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={16} />
        {t(program.doc.title, locale)}
      </Link>
      <div className="mt-4">
        <ProgressBar programId={program.id} stepKeys={program.doc.steps.map((s) => s.key)} labels={{ progress: dict.programs.progress }} />
      </div>
      <header className="mt-6">
        <p className="text-sm font-bold uppercase tracking-wide text-muted">
          {dict.common.step} {index + 1} {dict.common.of} {program.doc.steps.length} · {dict.programs.kind[step.kind]}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl">{title}</h1>
        {step.durationMin ? <p className="mt-2 text-sm text-muted">{step.durationMin} {dict.common.min}</p> : null}
      </header>

      {t(step.body, locale) ? <RichText text={t(step.body, locale)} className="mt-6 text-[17px] leading-relaxed" /> : null}

      {exercise ? (
        <section className="mt-8 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-xl">{t(exercise.doc.name, locale)}</h2>
          <p className="mt-2 text-muted">{t(exercise.doc.summary, locale)}</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5">
            {exercise.doc.instructions.map((s, i) => (
              <li key={i}>{t(s, locale)}</li>
            ))}
          </ol>
          {exercise.doc.safety.length > 0 ? (
            <ul className="mt-4 space-y-1 text-sm text-muted">
              {exercise.doc.safety.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-mauve" />
                  {t(s, locale)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {pose ? (
        <section className="mt-8 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface" aria-labelledby="step-pose-title">
          <div className="grid sm:grid-cols-[220px_1fr]">
            <div className="bg-surface-2">
              <PoseImage card={pose.media.card ?? pose.media.poster} alt="" sizes="220px" />
            </div>
            <div className="p-5">
              <h2 id="step-pose-title" className="text-xl">
                {t(pose.name, locale)}
              </h2>
              <p className="mt-1 text-sm text-muted">{pose.sanskrit}</p>
              <p className="mt-3 text-sm">{t(pose.summary, locale)}</p>
              <Link href={`/${locale}/poses/${pose.slug}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
                {dict.programs.openPose}
                <Icon name="arrowRight" size={14} />
              </Link>
            </div>
          </div>
          <div className="border-t border-line p-5">
            <StatusControl poseId={pose.id} labels={{ title: `${dict.actions.status} — ${dict.programs.learnedSeparately}`, values: dict.actions.statusValues }} />
          </div>
        </section>
      ) : null}

      {video ? (
        <section className="mt-8">
          <h2 className="text-xl">{dict.pose.video}</h2>
          <div className="mt-3">
            <VideoLesson
              key={video.url}
              video={video}
              poster={pose?.media.poster ? mediaUrl(pose.media.poster.url) : null}
              labels={{
                play: fmt(dict.pose.videoPlay, { title: video.title }),
                watchOn: fmt(dict.pose.watchOnProvider, { p: providerLabel(video.provider) }),
                by: fmt(dict.pose.videoBy, { author: video.author }),
                fallback: dict.pose.videoFallback,
                providerName: providerLabel(video.provider),
              }}
            />
          </div>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {prev ? (
            <Link href={`${base}/steps/${prev.key}`} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface" aria-label={dict.programs.prev} data-testid="step-prev">
              <Icon name="chevronLeft" />
            </Link>
          ) : null}
          <StepCompleteButton programId={program.id} stepKey={step.key} labels={{ mark: dict.actions.markStepComplete, done: dict.actions.stepDone, undo: dict.actions.undo }} />
          {next ? (
            <Link href={`${base}/steps/${next.key}`} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface" aria-label={dict.programs.next} data-testid="step-next">
              <Icon name="chevronRight" />
            </Link>
          ) : (
            <Link href={base} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface" aria-label={dict.programs.backToProgram}>
              <Icon name="layers" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
