import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage, getTaxonomy } from "@/lib/data/public";
import type { PageDoc } from "@/lib/content/schema";
import { t } from "@/lib/i18n/paths";
import { fmt } from "@/lib/i18n/format";
import { RichText } from "@/components/ui/RichText";
import { Icon } from "@/components/ui/Icon";

export async function contentMetadata(slug: string, locale: string): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const page = await getPage(slug);
  if (!page) return {};
  return {
    title: t(page.doc.title, locale),
    description: page.doc.intro ? t(page.doc.intro, locale).slice(0, 160) : undefined,
    alternates: { canonical: `/${locale}/${slug}`, languages: { ru: `/ru/${slug}`, en: `/en/${slug}` } },
  };
}

export async function ContentPage({ slug, locale: raw }: { slug: string; locale: string }) {
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const [page, taxonomy] = await Promise.all([getPage(slug), getTaxonomy()]);
  if (!page) notFound();
  const d = page.doc;
  const contact = slug === "contact" ? { email: d.contact?.email ?? taxonomy.settings.contact.email, socials: [...(d.contact?.socials ?? []), ...taxonomy.settings.contact.socials] } : null;
  return <ContentView doc={d} locale={locale} slug={slug} contact={contact} />;
}

export function ContentView({ doc: d, locale, slug, contact }: { doc: PageDoc; locale: Locale; slug: string; contact: { email: string | null; socials: { label: string; url: string }[] } | null }) {
  const dict = getDictionary(locale);
  void slug;
  return (
    <article className="mx-auto max-w-3xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
      <header>
        <h1 className="text-4xl sm:text-5xl">{t(d.title, locale)}</h1>
        {d.updatedOn ? (
          <p className="mt-3 text-sm text-muted">
            {fmt(dict.pages.updatedOn, { d: new Date(d.updatedOn).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) })}
          </p>
        ) : null}
        {d.intro ? <RichText text={t(d.intro, locale)} className="mt-5 text-lg text-muted" /> : null}
      </header>

      {d.sections.length > 0 ? (
        <div className="mt-10 space-y-10">
          {d.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-2xl">{t(s.heading, locale)}</h2>
              <RichText text={t(s.body, locale)} className="mt-3 leading-relaxed" />
            </section>
          ))}
        </div>
      ) : null}

      {d.items.length > 0 ? (
        <div className="mt-10 divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface">
          {d.items.map((item, i) => (
            <details key={i} className="group p-5" id={`q${i + 1}`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {t(item.q, locale)}
                <Icon name="chevronDown" className="shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <RichText text={t(item.a, locale)} className="mt-3 text-muted" />
            </details>
          ))}
        </div>
      ) : null}

      {contact ? (
        <section className="mt-10 rounded-[var(--radius-lg)] border border-line bg-surface p-6">
          {contact.email || contact.socials.length > 0 ? (
            <dl className="space-y-4">
              {contact.email ? (
                <div>
                  <dt className="text-sm font-semibold text-muted">{dict.pages.contactEmail}</dt>
                  <dd>
                    <a href={`mailto:${contact.email}`} className="text-lg font-semibold text-brand hover:underline">
                      {contact.email}
                    </a>
                  </dd>
                </div>
              ) : null}
              {contact.socials.length > 0 ? (
                <div>
                  <dt className="text-sm font-semibold text-muted">{dict.pages.contactSocial}</dt>
                  <dd className="mt-1 flex flex-wrap gap-3">
                    {contact.socials.map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
                        {s.label}
                      </a>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-muted">{dict.pages.contactMissing}</p>
          )}
        </section>
      ) : null}
    </article>
  );
}
