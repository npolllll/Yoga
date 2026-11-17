"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { encodeIntent, useMember } from "./MemberState";
import { buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/lib/i18n/config";

/** Modal shown when a guest tries to save something. After sign-in the original action is completed. */
export function AuthPrompt({
  locale,
  labels,
}: {
  locale: Locale;
  labels: { title: string; text: string; signIn: string; signUp: string; close: string };
}) {
  const { authPrompt, closeAuthPrompt } = useMember();
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (authPrompt && !d.open) d.showModal();
    if (!authPrompt && d.open) d.close();
  }, [authPrompt]);

  const next = authPrompt
    ? `${pathname}${typeof window !== "undefined" ? window.location.search : ""}${
        typeof window !== "undefined" && window.location.search ? "&" : "?"
      }intent=${encodeURIComponent(encodeIntent(authPrompt))}`
    : pathname;
  const q = `?next=${encodeURIComponent(next)}`;

  return (
    <dialog
      ref={ref}
      onClose={closeAuthPrompt}
      onClick={(e) => e.target === ref.current && closeAuthPrompt()}
      className="m-auto w-[min(92vw,420px)] rounded-[var(--radius-lg)] bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40"
      aria-labelledby="auth-prompt-title"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="auth-prompt-title" className="text-xl">
            {labels.title}
          </h2>
          <button type="button" onClick={closeAuthPrompt} className="rounded-full p-1 text-muted hover:text-ink" aria-label={labels.close}>
            <Icon name="close" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">{labels.text}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href={`/${locale}/login${q}`} className={buttonClass("dark", "md", "flex-1")}>
            {labels.signIn}
          </a>
          <a href={`/${locale}/sign-up${q}`} className={buttonClass("secondary", "md", "flex-1")}>
            {labels.signUp}
          </a>
        </div>
      </div>
    </dialog>
  );
}
