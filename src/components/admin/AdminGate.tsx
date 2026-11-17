import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

type GateProps = {
  locale: Locale;
  need?: "staff" | "editor" | "owner";
  children: (user: SessionUser) => React.ReactNode | Promise<React.ReactNode>;
};

/**
 * Server-side gate for admin screens. The real protection is RLS + role checks in every server action;
 * this only decides what to render. The session read sits inside a Suspense boundary, so navigation shows
 * the placeholder at once and the per-request content streams in (Cache Components: no request data in
 * the static shell).
 */
export function AdminGate(props: GateProps) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Gate {...props} />
    </Suspense>
  );
}

/** Placeholder shown while a per-request admin screen streams in. */
export function AdminFallback() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-[var(--radius-md)] bg-surface-2 motion-reduce:animate-none" />
    </div>
  );
}

async function Gate({ locale, need = "staff", children }: GateProps) {
  await connection(); // always rendered per request (never prerendered)
  const user = await getSessionUser();
  const dict = getDictionary(locale);
  const ok =
    !!user &&
    (need === "staff"
      ? user.roles.length > 0
      : need === "editor"
        ? user.roles.includes("editor") || user.roles.includes("owner")
        : user.roles.includes("owner"));
  if (!ok) {
    return (
      <div className="rounded-[var(--radius-md)] border border-line bg-surface p-8 text-center" data-testid="admin-no-access">
        <p className="text-lg">{dict.admin.noAccess}</p>
        {!user ? (
          <Link href={`/${locale}/login?next=/${locale}/admin`} className="mt-4 inline-block font-semibold text-brand hover:underline">
            {dict.auth.login}
          </Link>
        ) : null}
      </div>
    );
  }
  return <>{await children(user!)}</>;
}
