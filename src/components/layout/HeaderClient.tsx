"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useMember } from "@/components/member/MemberState";
import { LocaleSwitcher, LocaleSwitcherFallback } from "./LocaleSwitcher";
import type { Locale } from "@/lib/i18n/config";

export interface NavItem {
  href: string;
  label: string;
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="hidden items-center gap-1 lg:flex">
      {items.map((item) => {
        const active = item.href.split("/").length <= 2 ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                active ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
              {active ? <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand" aria-hidden="true" /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AccountLink({
  locale,
  labels,
}: {
  locale: Locale;
  labels: { profile: string; signIn: string; admin: string };
}) {
  const { status, user } = useMember();
  const signedIn = status === "member";
  const isStaff = !!user?.roles.length;
  return (
    <>
      {isStaff ? (
        <Link
          href={`/${locale}/admin`}
          className="hidden rounded-full px-3 py-2 text-sm font-semibold text-brand hover:bg-surface-2 md:inline-flex"
        >
          {labels.admin}
        </Link>
      ) : null}
      <Link
        href={signedIn ? `/${locale}/account` : `/${locale}/login`}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface-2"
        aria-label={signedIn ? labels.profile : labels.signIn}
        data-testid="account-link"
        data-signed-in={signedIn ? "true" : "false"}
      >
        {signedIn && user ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-lilac text-sm font-bold uppercase">
            {(user.displayName || user.email || "?").slice(0, 1)}
          </span>
        ) : (
          <Icon name="user" />
        )}
      </Link>
    </>
  );
}

export function MobileMenu({
  locale,
  items,
  labels,
}: {
  locale: Locale;
  items: NavItem[];
  labels: { menu: string; close: string; language: string };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2"
        aria-label={labels.menu}
        aria-expanded={open}
        aria-controls="mobile-menu"
      >
        <Icon name="menu" />
      </button>
      {open ? (
        <div id="mobile-menu" role="dialog" aria-modal="true" aria-label={labels.menu} className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="animate-rise absolute inset-x-0 top-0 rounded-b-[var(--radius-lg)] bg-surface p-5 shadow-lift">
            <div className="flex items-center justify-between">
              <span className="font-serif text-lg tracking-[0.18em]">BALANCE</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2"
                aria-label={labels.close}
                autoFocus
              >
                <Icon name="close" />
              </button>
            </div>
            <ul className="mt-4 flex flex-col">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-12 items-center justify-between border-b border-line py-3 text-lg font-semibold"
                  >
                    {item.label}
                    <Icon name="chevronRight" size={18} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm text-muted">{labels.language}</span>
              <Suspense fallback={<LocaleSwitcherFallback locale={locale} />}>
                <LocaleSwitcher locale={locale} label={labels.language} />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
