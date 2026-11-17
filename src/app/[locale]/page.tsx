import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCatalog, getPage, getPrograms, getTaxonomy } from "@/lib/data/public";
import { toLibraryPose } from "@/lib/data/view";
import { t } from "@/lib/i18n/paths";
import { fmt } from "@/lib/i18n/format";
import { mediaUrl } from "@/lib/media";
import { brandImage } from "@/lib/brand-media";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { PoseCard } from "@/components/pose/PoseCard";
import { PracticeCta } from "@/components/home/PracticeCta";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: { absolute: dict.meta.defaultTitle },
    alternates: { canonical: `/${locale}`, languages: { ru: "/ru", en: "/en" } },
  };
}

const CATEGORY_ICONS: Record<string, IconName> = {
  "arm-balances": "dumbbell",
  "side-balances": "layers",
  "shoulder-balances": "up",
  handstands: "arrowRight",
  "forearm-balances": "trend",
  "one-arm-balances": "target",
  transitions: "replay",
};

function BrandPicture({ name, className = "", priority = false, alt = "" }: { name: string; className?: string; priority?: boolean; alt?: string }) {
  const img = brandImage(name);
  if (!img) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-rendered brand illustration (WebP)
    <img
      src={mediaUrl(img.url)}
      width={img.width}
      height={img.height}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={className}
    />
  );
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const [catalog, taxonomy, home, faq, programs] = await Promise.all([
    getCatalog(),
    getTaxonomy(),
    getPage("home"),
    getPage("faq"),
    getPrograms(),
  ]);

  // Editable texts: the "home" page document can override any default copy by key (e.g. "heroTitle").
  const blocks = home?.doc.blocks ?? {};
  const h = (key: keyof typeof dict.home & string) => {
    const override = blocks[key];
    if (override && t(override, locale)) return t(override, locale);
    return dict.home[key] as string;
  };

  const featuredSlugs = home?.doc.featured?.length ? home.doc.featured : ["bakasana", "parsva-bakasana", "tittibhasana", "astavakrasana"];
  const featured = featuredSlugs
    .map((s) => catalog.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 6);
  const featuredList = featured.length > 0 ? featured : [...catalog].sort((a, b) => a.sortWeight - b.sortWeight).slice(0, 4);
  const favLabels = { add: dict.actions.favorite, remove: dict.actions.removeFavorite, added: dict.actions.favorited };
  const faqItems = faq?.doc.items.slice(0, 3) ?? [];
  const countByCategory = (key: string) => catalog.filter((p) => p.categoryKey === key).length;
  const programByLevel = (key: string) => programs.find((p) => p.levelKey === key);

  return (
    <>
      {/* Hero */}
      <section className="glow-surface relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div>
            <h1 className="text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">{h("heroTitle")}</h1>
            <p className="mt-6 max-w-xl text-lg text-muted">{h("heroText")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={`/${locale}/poses`} size="lg">
                {h("explorePoses")}
                <Icon name="arrowRight" size={18} />
              </ButtonLink>
              <ButtonLink href={`/${locale}/programs`} variant="secondary" size="lg">
                {h("startLearning")}
              </ButtonLink>
            </div>
            <p className="mt-6 text-sm text-muted">{h("heroNote")}</p>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full text-white" aria-hidden="true">
              {[150, 125, 100, 75].map((r, i) => (
                <ellipse key={r} cx="215" cy="190" rx={r + 10} ry={r} fill="none" stroke="currentColor" strokeWidth="2" opacity={0.9 - i * 0.15} transform={`rotate(${-12 + i * 6} 215 190)`} />
              ))}
            </svg>
            <BrandPicture name="hero" priority className="relative mx-auto h-auto w-full max-w-sm drop-shadow-xl" />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6" aria-labelledby="categories-title">
        <h2 id="categories-title" className="text-3xl sm:text-4xl">{h("categoriesTitle")}</h2>
        <p className="mt-3 text-muted">{h("categoriesText")}</p>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {taxonomy.categories.map((c) => (
            <li key={c.key}>
              <Link
                href={`/${locale}/poses?type=${c.key}`}
                className="group flex h-full flex-col items-center rounded-[var(--radius-lg)] border border-line bg-surface p-4 text-center shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex h-24 w-full items-center justify-center">
                  {brandImage(`category-${c.key}`) ? (
                    <BrandPicture name={`category-${c.key}`} className="h-24 w-auto object-contain" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-mauve">
                      <Icon name={CATEGORY_ICONS[c.key] ?? "lotus"} size={26} />
                    </span>
                  )}
                </div>
                <span className="mt-3 font-semibold leading-tight">{t(c.name, locale)}</span>
                <span className="ornament mt-2 text-xs" aria-hidden="true">✦</span>
                <span className="sr-only">{countByCategory(c.key)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Levels */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6" aria-labelledby="levels-title">
        <h2 id="levels-title" className="text-3xl sm:text-4xl">{h("levelsTitle")}</h2>
        <p className="mt-3 text-muted">{h("levelsText")}</p>
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {taxonomy.levels.map((l) => {
            const program = programByLevel(l.key);
            return (
              <li key={l.key} className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-soft">
                <div className="glow-surface flex h-40 items-end justify-center">
                  {brandImage(`level-${l.key}`) ? (
                    <BrandPicture name={`level-${l.key}`} className="h-40 w-auto object-contain" />
                  ) : (
                    <span className="mb-6 text-mauve"><Icon name="lotus" size={56} strokeWidth={1.1} /></span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-xl">{t(l.label, locale)}</h3>
                  <LevelBadge rank={l.rank} label={t(l.label, locale)} showLabel={false} ariaLabel={fmt(dict.levels.dotsLabel, { level: t(l.label, locale) })} />
                  <p className="mt-2 flex-1 text-sm text-muted">{t(l.description, locale)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/${locale}/poses?level=${l.key}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                      {h("levelPoses")} <Icon name="arrowRight" size={14} />
                    </Link>
                    {program ? (
                      <Link href={`/${locale}/programs/${program.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                        {h("levelProgram")} <Icon name="arrowRight" size={14} />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Featured poses */}
      {featuredList.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6" aria-labelledby="featured-title">
          <h2 id="featured-title" className="text-3xl sm:text-4xl">{h("featuredTitle")}</h2>
          <p className="mt-3 text-muted">{h("featuredText")}</p>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {featuredList.map((p) => {
              const lp = toLibraryPose(p, taxonomy.levels, locale);
              return (
                <li key={p.id}>
                  <PoseCard pose={lp} href={`/${locale}/poses/${p.slug}`} favoriteLabels={favLabels} levelAria={fmt(dict.levels.dotsLabel, { level: lp.levelLabel })} />
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex justify-center">
            <ButtonLink href={`/${locale}/poses`} variant="secondary">
              {dict.common.viewAll}
              <Icon name="arrowRight" size={16} />
            </ButtonLink>
          </div>
        </section>
      ) : null}

      {/* Training teaser */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <div className="glow-surface grid items-center gap-8 overflow-hidden rounded-[var(--radius-lg)] p-8 sm:p-10 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-3xl sm:text-4xl">{h("trainingTitle")}</h2>
            <p className="mt-3 text-muted">{h("trainingText")}</p>
            <ul className="mt-5 grid grid-cols-2 gap-2 text-sm font-semibold">
              {dict.home.trainingAreas.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <Icon name="check" size={16} className="text-brand" />
                  {a}
                </li>
              ))}
            </ul>
            <ButtonLink href={`/${locale}/programs`} className="mt-6" variant="dark">
              {h("explorePrograms")}
              <Icon name="arrowRight" size={16} />
            </ButtonLink>
          </div>
          <BrandPicture name="training" className="mx-auto h-56 w-auto object-contain" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6" aria-labelledby="how-title">
        <h2 id="how-title" className="text-center text-3xl sm:text-4xl">{h("howTitle")}</h2>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {dict.home.how.map((step, i) => (
            <li key={step.title} className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lilac-soft text-brand">
                <Icon name={(["search", "book", "trend"] as const)[i]} size={24} />
              </span>
              <h3 className="mt-4 text-xl">
                {i + 1}. {step.title}
              </h3>
              <p className="mt-2 text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* My practice teaser */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <div className="grid items-center gap-6 rounded-[var(--radius-lg)] border border-line bg-surface p-8 sm:p-10 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-3xl">{h("practiceTitle")}</h2>
            <p className="mt-3 max-w-2xl text-muted">{h("practiceText")}</p>
          </div>
          <PracticeCta locale={locale} memberLabel={h("practiceCtaMember")} guestLabel={h("practiceCtaGuest")} />
        </div>
      </section>

      {/* Why BALANCE */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6" aria-labelledby="why-title">
        <h2 id="why-title" className="text-3xl sm:text-4xl">{h("whyTitle")}</h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {dict.home.why.map((w, i) => (
            <li key={w.title} className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-soft">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-mauve">
                <Icon name={(["eye", "layers", "calendar"] as const)[i]} size={22} />
              </span>
              <h3 className="mt-4 text-xl">{w.title}</h3>
              <p className="mt-2 text-muted">{w.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      {faqItems.length > 0 ? (
        <section className="mx-auto max-w-3xl px-4 pt-20 sm:px-6" aria-labelledby="faq-title">
          <h2 id="faq-title" className="text-center text-3xl sm:text-4xl">{h("faqTitle")}</h2>
          <div className="mt-8 divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface">
            {faqItems.map((item, i) => (
              <details key={i} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {t(item.q, locale)}
                  <Icon name="chevronDown" className="shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-muted">{t(item.a, locale)}</p>
              </details>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href={`/${locale}/faq`} className="font-semibold text-brand hover:underline">
              {h("faqAll")}
            </Link>
          </div>
        </section>
      ) : null}

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <div className="glow-surface rounded-[var(--radius-lg)] px-6 py-14 text-center">
          <h2 className="text-3xl sm:text-4xl">{h("finalTitle")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">{h("finalText")}</p>
          <ButtonLink href={`/${locale}/programs`} size="lg" className="mt-8">
            <Icon name="sparkle" size={18} />
            {h("finalCta")}
            <Icon name="sparkle" size={18} />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
