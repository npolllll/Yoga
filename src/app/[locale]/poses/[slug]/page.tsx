import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCatalog, getExercises, getPose, getPrograms, getTaxonomy } from "@/lib/data/public";
import { levelInfo, secondaryName } from "@/lib/data/view";
import { t } from "@/lib/i18n/paths";
import { fmt } from "@/lib/i18n/format";
import { mediaUrl, providerLabel } from "@/lib/media";
import { Icon } from "@/components/ui/Icon";
import { LevelBadge, Pill } from "@/components/ui/LevelBadge";
import { RichText } from "@/components/ui/RichText";
import { AnimationPlayer } from "@/components/pose/AnimationPlayer";
import { VideoLesson } from "@/components/pose/VideoLesson";
import { FavoriteButton, StatusControl } from "@/components/pose/PoseActions";
import { PoseCard } from "@/components/pose/PoseCard";
import { toLibraryPose } from "@/lib/data/view";

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

function Section({ id, title, children, className = "" }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-24 ${className}`}>
      <h2 id={`${id}-title`} className="text-2xl sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
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
  const dict = getDictionary(locale);
  const d = pose.doc;
  const name = t(pose.name, locale);
  const level = levelInfo(taxonomy.levels, pose.levelKey, locale);
  const category = taxonomy.categories.find((c) => c.key === pose.categoryKey);
  const skills = taxonomy.skills.filter((s) => pose.skillKeys.includes(s.key));
  const otherName = locale === "ru" ? pose.name.en : pose.name.ru;
  const poster = pose.media.poster ? mediaUrl(pose.media.poster.url) : null;
  const animSources = pose.media.animation
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ url: mediaUrl(m.url), mime: (m.meta.type as string) || m.mime }));
  const keyframes = pose.media.keyframes;
  const video = d.video[locale] ?? null;
  const favLabels = { add: dict.actions.favorite, remove: dict.actions.removeFavorite, added: dict.actions.favorited };
  const exerciseBySlug = new Map(exercises.map((e) => [e.slug, e]));
  const relatedSlugs = [...new Set([...d.easier, ...d.harder, ...d.related])];
  const bySlug = new Map(catalog.map((p) => [p.slug, p]));
  const inPrograms = programs.filter((p) => p.doc.steps.some((s) => s.kind === "pose" && s.poseId === pose.id));
  const width = pose.media.poster?.width ?? 1280;
  const height = pose.media.poster?.height ?? 960;

  const relatedGroup = (title: string, slugs: string[]) => {
    const items = slugs.map((s) => bySlug.get(s)).filter((p): p is NonNullable<typeof p> => !!p);
    if (items.length === 0) return null;
    return (
      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((p) => {
            const lp = toLibraryPose(p, taxonomy.levels, locale);
            return (
              <li key={p.slug}>
                <PoseCard pose={lp} href={`/${locale}/poses/${p.slug}`} favoriteLabels={favLabels} levelAria={fmt(dict.levels.dotsLabel, { level: lp.levelLabel })} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <article className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6" data-testid="pose-page" data-pose-id={pose.id}>
      <Link href={`/${locale}/poses`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <Icon name="arrowLeft" size={16} />
        {dict.pose.backToLibrary}
      </Link>

      <header className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl leading-tight sm:text-5xl">{name}</h1>
          <p className="mt-2 text-lg text-muted">
            {[d.subtitle ? t(d.subtitle, locale) : null, otherName !== name ? otherName : null, pose.sanskrit]
              .filter((x, i, arr) => x && arr.indexOf(x) === i)
              .join(" · ")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Pill tone="lilac">
              <LevelBadge rank={level.rank} label={level.label} ariaLabel={fmt(dict.levels.dotsLabel, { level: level.label })} />
            </Pill>
            {category ? (
              <Link href={`/${locale}/poses?type=${category.key}`} className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:bg-surface-3">
                {t(category.name, locale)}
              </Link>
            ) : null}
          </div>
        </div>
        <FavoriteButton poseId={pose.id} labels={favLabels} />
      </header>

      {!pose.expertApproved ? (
        <p className="mt-6 flex gap-3 rounded-[var(--radius-md)] bg-warning-soft p-4 text-sm text-warning" role="note">
          <Icon name="info" className="shrink-0" />
          {dict.common.unreviewedNotice}
        </p>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div>
          <AnimationPlayer
            poster={poster}
            posterAlt={t(pose.media.poster?.alt as { ru: string; en: string } | undefined, locale) || name}
            sources={animSources}
            phases={d.animationPhases.map((p) => ({ fromSec: p.fromSec, toSec: p.toSec, label: t(p.label, locale) }))}
            labels={{
              play: dict.pose.play,
              pause: dict.pose.pause,
              replay: dict.pose.replay,
              playCta: dict.pose.playAnimation,
              reducedMotion: dict.pose.reducedMotion,
              missing: dict.pose.animationMissing,
              animation: `${dict.pose.animation}: ${name}`,
            }}
            width={width}
            height={height}
          />
          {keyframes.length > 0 ? (
            <div className="mt-4">
              <h2 className="sr-only">{dict.pose.keyframes}</h2>
              <ol className="grid grid-cols-5 gap-2" aria-label={dict.pose.keyframes}>
                {keyframes.map((k, i) => (
                  <li key={k.id} className="overflow-hidden rounded-[var(--radius-sm)] border border-line bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- small pre-optimized keyframe */}
                    <img
                      src={mediaUrl(k.url)}
                      alt={t(k.alt as { ru: string; en: string }, locale) || fmt(dict.pose.keyframeAlt, { name, i: i + 1 })}
                      width={k.width ?? 320}
                      height={k.height ?? 240}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/3] w-full object-contain"
                    />
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        <aside className="space-y-6 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6">
          <div>
            <h2 className="text-xl">{dict.pose.about}</h2>
            <p className="mt-2 text-muted">{t(d.summary, locale)}</p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label={dict.library.skills}>
            {skills.map((s) => (
              <Link key={s.key} href={`/${locale}/poses?skills=${s.key}`} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted hover:text-ink">
                {t(s.name, locale)}
              </Link>
            ))}
          </div>
          <StatusControl poseId={pose.id} labels={{ title: dict.actions.status, values: dict.actions.statusValues }} />
          <FavoriteButton poseId={pose.id} labels={favLabels} variant="button" />
        </aside>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-12">
          <Section id="about" title={dict.pose.about}>
            <RichText text={t(d.about, locale)} className="text-[17px] leading-relaxed" />
          </Section>

          {d.prerequisites.length > 0 ? (
            <Section id="prerequisites" title={dict.pose.prerequisites}>
              <ul className="space-y-2">
                {d.prerequisites.map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <Icon name="check" className="mt-0.5 shrink-0 text-success" />
                    <span>{t(p, locale)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section id="safety" title={dict.pose.safety}>
            <ul className="space-y-2 rounded-[var(--radius-md)] border border-line bg-surface-2 p-5">
              {d.safety.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <Icon name="alert" className="mt-0.5 shrink-0 text-mauve" />
                  <span>{t(s, locale)}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="how-to" title={dict.pose.howTo}>
            <ol className="space-y-5">
              {d.steps.map((s, i) => {
                const kf = s.keyframe !== undefined ? keyframes[s.keyframe] : undefined;
                return (
                  <li key={s.key} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lilac-soft font-serif text-lg font-semibold" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-sans text-lg font-bold">{t(s.title, locale)}</h3>
                      <p className="mt-1 text-muted">{t(s.body, locale)}</p>
                    </div>
                    {kf ? (
                      // eslint-disable-next-line @next/next/no-img-element -- keyframe thumbnail
                      <img src={mediaUrl(kf.url)} alt="" width={96} height={72} loading="lazy" className="hidden h-[72px] w-24 shrink-0 rounded-[var(--radius-sm)] border border-line bg-surface-2 object-contain sm:block" />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </Section>
        </div>

        <div className="space-y-12">
          <Section id="anatomy" title={dict.pose.anatomy}>
            {d.anatomy ? <p className="text-muted">{t(d.anatomy, locale)}</p> : null}
            <ul className="mt-4 space-y-2">
              {d.muscles.map((m, i) => (
                <li key={m.key} className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-full border-2 border-mauve" style={{ background: i < 3 ? "var(--c-mauve)" : "transparent" }} aria-hidden="true" />
                  <span>
                    <span className="font-semibold">{dict.muscles[m.key]}</span>
                    {m.note ? <span className="text-muted"> — {t(m.note, locale)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="prep" title={dict.pose.prep}>
            <ul className="space-y-3">
              {d.prep.map((p, i) => {
                const ex = p.exerciseSlug ? exerciseBySlug.get(p.exerciseSlug) : undefined;
                return (
                  <li key={i} className="rounded-[var(--radius-md)] border border-line bg-surface">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4">
                        <span>
                          <span className="block font-semibold">{t(p.title, locale)}</span>
                          <span className="mt-1 block text-sm text-muted">{t(p.body, locale)}</span>
                        </span>
                        {ex ? <Icon name="chevronDown" className="mt-1 shrink-0 transition-transform group-open:rotate-180" /> : null}
                      </summary>
                      {ex ? (
                        <div className="border-t border-line px-4 pb-4 pt-3 text-sm">
                          <p className="font-semibold">{t(ex.doc.name, locale)}</p>
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
                            {ex.doc.instructions.map((s, j) => (
                              <li key={j}>{t(s, locale)}</li>
                            ))}
                          </ol>
                          {ex.doc.safety.length > 0 ? <p className="mt-2 text-xs text-muted">{ex.doc.safety.map((s) => t(s, locale)).join(" ")}</p> : null}
                        </div>
                      ) : null}
                    </details>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>
      </div>

      <div className="mt-12">
        <Section id="mistakes" title={dict.pose.mistakes}>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {d.mistakes.map((m, i) => (
              <li key={i} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
                <h3 className="flex items-start gap-2 font-sans text-base font-bold">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger" aria-hidden="true">
                    <Icon name="close" size={14} />
                  </span>
                  {t(m.title, locale)}
                </h3>
                <p className="mt-2 text-sm text-muted">
                  <span className="font-semibold text-ink">{dict.pose.mistakeWhy}: </span>
                  {t(m.why, locale)}
                </p>
                <p className="mt-2 flex gap-2 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden="true">
                    <Icon name="check" size={12} />
                  </span>
                  <span>
                    <span className="font-semibold">{dict.pose.mistakeFix}: </span>
                    {t(m.fix, locale)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <Section id="video" title={dict.pose.video}>
          {video ? (
            <VideoLesson
              key={video.url}
              video={video}
              poster={poster}
              labels={{
                play: fmt(dict.pose.videoPlay, { title: video.title }),
                watchOn: fmt(dict.pose.watchOnProvider, { p: providerLabel(video.provider) }),
                by: fmt(dict.pose.videoBy, { author: video.author }),
                fallback: dict.pose.videoFallback,
                providerName: providerLabel(video.provider),
              }}
            />
          ) : (
            <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong bg-surface p-6 text-sm text-muted" data-testid="video-missing">
              {dict.pose.videoMissing}
            </p>
          )}
        </Section>
        {inPrograms.length > 0 ? (
          <Section id="programs" title={dict.pose.inPrograms}>
            <ul className="space-y-3">
              {inPrograms.map((p) => {
                const step = p.doc.steps.find((s) => s.kind === "pose" && s.poseId === pose.id)!;
                return (
                  <li key={p.id}>
                    <Link href={`/${locale}/programs/${p.slug}/steps/${step.key}`} className="flex items-center justify-between rounded-[var(--radius-md)] border border-line bg-surface p-4 hover:border-brand">
                      <span className="font-semibold">{t(p.doc.title, locale)}</span>
                      <Icon name="arrowRight" className="text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}
      </div>

      {relatedSlugs.length > 0 ? (
        <div className="mt-12 space-y-8">
          <h2 className="text-2xl sm:text-3xl">{dict.pose.related}</h2>
          {relatedGroup(dict.pose.easier, d.easier)}
          {relatedGroup(dict.pose.harder, d.harder)}
          {relatedGroup(dict.pose.related, d.related.filter((s) => !d.easier.includes(s) && !d.harder.includes(s)))}
        </div>
      ) : null}

      <section className="mt-12 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6" aria-label={dict.actions.status}>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <StatusControl poseId={pose.id} labels={{ title: dict.actions.status, values: dict.actions.statusValues }} />
          <div className="flex sm:w-64">
            <FavoriteButton poseId={pose.id} labels={favLabels} variant="button" />
          </div>
        </div>
      </section>

      {d.sources.length > 0 ? (
        <footer className="mt-10 text-sm text-muted">
          <h2 className="font-sans text-sm font-bold uppercase tracking-wide">{dict.pose.sources}</h2>
          <ul className="mt-2 space-y-1">
            {d.sources.map((s, i) => (
              <li key={i}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
                {s.note ? ` — ${s.note}` : null}
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
      <span className="sr-only">{secondaryName(pose, locale)}</span>
    </article>
  );
}
