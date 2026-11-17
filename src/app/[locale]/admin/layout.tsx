import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const a = getDictionary(locale).admin;
  const nav = [
    ["", a.dashboard],
    ["/list/pose", a.poses],
    ["/list/program", a.programs],
    ["/list/exercise", a.exercises],
    ["/list/page", a.pages],
    ["/media", a.media],
    ["/settings", a.settings],
    ["/users", a.users],
    ["/audit", a.audit],
  ] as const;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav aria-label={a.title} className="lg:w-52 lg:shrink-0">
          <p className="mb-3 font-serif text-xl">{a.title}</p>
          <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {nav.map(([href, label]) => (
              <li key={href}>
                <Link href={`/${locale}/admin${href}`} className="block whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">
          <Suspense fallback={<div className="skeleton h-96" />}>{children}</Suspense>
        </div>
      </div>
    </div>
  );
}
