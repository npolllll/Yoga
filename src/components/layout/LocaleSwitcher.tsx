"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { LOCALES, type Locale, switchLocalePath } from "@/lib/i18n/config";

/**
 * Keeps the current page, query (filters) and hash when switching language.
 * Rendered inside <Suspense> because it reads search params.
 */
export function LocaleSwitcher({ locale, label, compact = false }: { locale: Locale; label: string; compact?: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  return (
    <nav aria-label={label} className="inline-flex w-max items-center rounded-full border border-line bg-surface p-0.5 text-xs font-bold">
      {LOCALES.map((l) => {
        const href = `${switchLocalePath(pathname, l)}${query ? `?${query}` : ""}`;
        const active = l === locale;
        return (
          // A full document load: the root layout (html lang, metadata) belongs to the locale.
          <a
            key={l}
            href={href}
            hrefLang={l}
            lang={l}
            aria-current={active ? "true" : undefined}
            onClick={(e) => {
              if (typeof window !== "undefined" && window.location.hash) {
                e.preventDefault();
                // Full document load on purpose (DECISIONS: no hidden copy of the other language's page).
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.assign(href + window.location.hash);
              }
            }}
            className={`${compact ? "px-2.5 py-1" : "px-3 py-1.5"} rounded-full uppercase transition-colors ${
              active ? "bg-ink text-white" : "text-muted hover:text-ink"
            }`}
          >
            {l}
          </a>
        );
      })}
    </nav>
  );
}

export function LocaleSwitcherFallback({ locale }: { locale: Locale }) {
  return (
    <div className="inline-flex w-max items-center rounded-full border border-line bg-surface p-0.5 text-xs font-bold" aria-hidden="true">
      {LOCALES.map((l) => (
        <span key={l} className={`rounded-full px-3 py-1.5 uppercase ${l === locale ? "bg-ink text-white" : "text-muted"}`}>
          {l}
        </span>
      ))}
    </div>
  );
}
