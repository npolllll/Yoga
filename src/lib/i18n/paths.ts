import type { Locale } from "./config";

/** Builds a localized internal URL. */
export function lp(locale: Locale, path = ""): string {
  if (!path || path === "/") return `/${locale}`;
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Picks the value for the current locale with a safe fallback to the other language. */
export function t<T extends { ru: string; en: string } | undefined | null>(value: T, locale: Locale): string {
  if (!value) return "";
  return value[locale]?.trim() ? value[locale] : value[locale === "ru" ? "en" : "ru"] ?? "";
}

/** Only allows same-site relative redirects (prevents open redirects in ?next=). */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
