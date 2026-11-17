"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMember } from "@/components/member/MemberState";
import { buttonClass } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { deleteAccount, updateProfile } from "@/app/actions/member";
import { signOutAction } from "@/app/actions/auth";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const field = "mt-1.5 h-12 w-full rounded-[var(--radius-md)] border border-line-strong bg-surface px-4 text-base";

export function AccountPanel({
  locale,
  dict,
}: {
  locale: "ru" | "en";
  dict: { account: Dictionary["account"]; auth: Dictionary["auth"]; nav: Dictionary["nav"]; common: Dictionary["common"]; actions: Dictionary["actions"] };
}) {
  const member = useMember();
  const router = useRouter();
  const toast = useToast();
  const a = dict.account;
  const [name, setName] = useState("");
  const [lang, setLang] = useState<"ru" | "en">(locale);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // Fill the form once the profile is known (and when it changes on the server) — adjusted during render.
  const profileSig = member.user ? `${member.user.id}|${member.user.displayName ?? ""}|${member.user.locale}` : "";
  const [syncedProfile, setSyncedProfile] = useState("");
  if (member.user && profileSig !== syncedProfile) {
    setSyncedProfile(profileSig);
    setName(member.user.displayName ?? "");
    setLang(member.user.locale);
  }

  if (member.status === "loading") return <div className="skeleton mt-8 h-64" />;
  if (member.status === "guest") {
    return (
      <div className="mt-8 rounded-[var(--radius-lg)] border border-line bg-surface p-8 text-center">
        <p className="text-muted">{dict.actions.signInToSaveText}</p>
        <Link href={`/${locale}/login?next=/${locale}/account`} className={buttonClass("dark", "md", "mt-6")}>
          {dict.auth.login}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
        <h2 className="text-2xl">{a.settings}</h2>
        <p className="mt-1 text-sm text-muted">{member.user?.email}</p>
        <form
          className="mt-5 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await updateProfile({ displayName: name, locale: lang });
            setBusy(false);
            if (!res.ok) return toast(dict.actions.saveError, "error");
            toast(dict.common.saved, "success");
            await member.refresh();
            if (lang !== locale) router.push(`/${lang}/account`);
          }}
        >
          <label className="block text-sm font-semibold">
            {dict.auth.displayName}
            <input className={field} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} data-testid="profile-name" />
          </label>
          <label className="block text-sm font-semibold">
            {a.preferredLanguage}
            <select className={field} value={lang} onChange={(e) => setLang(e.target.value as "ru" | "en")}>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </label>
          <button type="submit" disabled={busy} className={buttonClass("dark")}>
            {a.saveProfile}
          </button>
        </form>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-6">
          <Link href={`/${locale}/update-password`} className={buttonClass("secondary", "sm")}>
            {a.changePassword}
          </Link>
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={buttonClass("ghost", "sm")} data-testid="sign-out">
              {dict.nav.signOut}
            </button>
          </form>
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
          <h2 className="text-2xl">{a.exportTitle}</h2>
          <p className="mt-2 text-sm text-muted">{a.exportText}</p>
          <a href="/api/me/export" className={buttonClass("secondary", "md", "mt-4")} data-testid="export-data" download>
            {a.exportButton}
          </a>
        </section>
        <section className="rounded-[var(--radius-lg)] border border-danger/30 bg-danger-soft/40 p-6">
          <h2 className="text-2xl text-danger">{a.deleteTitle}</h2>
          <p className="mt-2 text-sm">{a.deleteText}</p>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (confirm.trim() !== a.deleteConfirmWord) return;
              setBusy(true);
              const res = await deleteAccount(confirm, a.deleteConfirmWord);
              setBusy(false);
              if (!res.ok) return toast(dict.actions.saveError, "error");
              toast(a.deleted, "success");
              // Full reload on purpose: the deleted account must not survive in any client cache.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign(`/${locale}`);
            }}
          >
            <label className="block text-sm font-semibold">
              {a.deleteConfirmLabel}
              <input className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" data-testid="delete-confirm" />
            </label>
            <button type="submit" disabled={busy || confirm.trim() !== a.deleteConfirmWord} className={buttonClass("danger")} data-testid="delete-account">
              {a.deleteButton}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
