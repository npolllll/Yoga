import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { AccountLink, MobileMenu, NavLinks, type NavItem } from "./HeaderClient";
import { LocaleSwitcher, LocaleSwitcherFallback } from "./LocaleSwitcher";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const n = dict.nav;
  const items: NavItem[] = [
    { href: `/${locale}`, label: n.home },
    { href: `/${locale}/poses`, label: n.poses },
    { href: `/${locale}/programs`, label: n.programs },
    { href: `/${locale}/my-practice`, label: n.practice },
    { href: `/${locale}/about`, label: n.about },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-md">
      <nav aria-label={n.menu} className="mx-auto flex h-[var(--header-h)] max-w-6xl items-center gap-2 px-4 sm:px-6">
        {/* No prefetch: the home route's LCP hero (fetchPriority=high) would be preloaded on every page and
            compete with that page's own LCP image. Home is static, so a click still opens it quickly. */}
        <Link href={`/${locale}`} prefetch={false} className="mr-auto font-serif text-xl tracking-[0.18em] text-ink lg:mr-6" aria-label="BALANCE">
          BALANCE
        </Link>
        <NavLinks items={items} />
        <div className="ml-auto flex items-center gap-1">
          <div className="hidden sm:block">
            <Suspense fallback={<LocaleSwitcherFallback locale={locale} />}>
              <LocaleSwitcher locale={locale} label={n.languageLabel} compact />
            </Suspense>
          </div>
          <Link
            href={`/${locale}/poses?focus=search`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2"
            aria-label={n.search}
          >
            <Icon name="search" />
          </Link>
          <Link
            href={`/${locale}/my-practice?tab=favorites`}
            className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2 sm:inline-flex"
            aria-label={n.favorites}
          >
            <Icon name="heart" />
          </Link>
          <AccountLink locale={locale} labels={{ profile: n.profile, signIn: n.signIn, admin: n.admin }} />
          <MobileMenu locale={locale} items={items} labels={{ menu: n.menu, close: n.closeMenu, language: n.languageLabel }} />
        </div>
      </nav>
    </header>
  );
}
