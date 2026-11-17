import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { LocaleSwitcher, LocaleSwitcherFallback } from "./LocaleSwitcher";

export function Footer({
  locale,
  dict,
  socials,
}: {
  locale: Locale;
  dict: Dictionary;
  socials: { label: string; url: string }[];
}) {
  const n = dict.nav;
  const links = [
    { href: `/${locale}/poses`, label: n.poses },
    { href: `/${locale}/programs`, label: n.programs },
    { href: `/${locale}/my-practice`, label: n.practice },
    { href: `/${locale}/about`, label: n.about },
    { href: `/${locale}/faq`, label: n.faq },
    { href: `/${locale}/contact`, label: n.contact },
  ];
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_2fr]">
        <div>
          <p className="font-serif text-2xl tracking-[0.18em]">BALANCE</p>
          <p className="mt-2 text-sm text-muted">{dict.footer.tagline}</p>
          <div className="mt-5">
            <Suspense fallback={<LocaleSwitcherFallback locale={locale} />}>
              <LocaleSwitcher locale={locale} label={n.languageLabel} />
            </Suspense>
          </div>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-ink hover:text-brand">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="text-sm">
            {socials.length > 0 ? (
              <ul className="mb-4 flex flex-wrap gap-3">
                {socials.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} rel="noopener noreferrer" target="_blank" className="font-semibold text-brand hover:underline">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <ul className="space-y-3">
              <li>
                <Link href={`/${locale}/privacy`} className="text-muted hover:text-ink">
                  {dict.footer.privacy}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="text-muted hover:text-ink">
                  {dict.footer.terms}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:px-6 md:flex-row md:justify-between">
          <p>{dict.footer.disclaimer}</p>
          <p>© BALANCE</p>
        </div>
      </div>
    </footer>
  );
}
