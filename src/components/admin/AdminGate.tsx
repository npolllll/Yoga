import Link from "next/link";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

/**
 * Server-side gate for admin screens. The real protection is RLS + role checks in every server action;
 * this only decides what to render.
 */
export async function AdminGate({
  locale,
  need = "staff",
  children,
}: {
  locale: Locale;
  need?: "staff" | "editor" | "owner";
  children: (user: SessionUser) => React.ReactNode | Promise<React.ReactNode>;
}) {
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
