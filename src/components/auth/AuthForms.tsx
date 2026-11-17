"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, requestResetAction, updatePasswordAction, type AuthState } from "@/app/actions/auth";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type AuthDict = Dictionary["auth"];

function errorText(dict: AuthDict, state: AuthState) {
  switch (state.error) {
    case "credentials":
      return dict.invalidCredentials;
    case "weak":
      return dict.weakPassword;
    case "taken":
      return dict.emailTaken;
    case "consent":
      return dict.consentRequired;
    case "rate":
      return dict.rateLimited;
    case "invalid":
      return dict.invalidCredentials;
    case "generic":
      return dict.emailTaken;
    default:
      return null;
  }
}

const input =
  "mt-1.5 h-12 w-full rounded-[var(--radius-md)] border border-line-strong bg-surface px-4 text-base outline-none transition-colors focus:border-brand";
const label = "block text-sm font-semibold";
const submit =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60";

function Alert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "success" }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-[var(--radius-md)] p-3 text-sm ${tone === "error" ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
      {children}
    </p>
  );
}

export function LoginForm({ locale, dict, next, linkError }: { locale: string; dict: AuthDict; next: string; linkError?: boolean }) {
  const [state, action, pending] = useActionState(signInAction, {});
  const err = errorText(dict, state);
  return (
    <form action={action} className="space-y-4" data-testid="login-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      {linkError ? <Alert>{dict.linkInvalid}</Alert> : null}
      {err ? <Alert>{err}</Alert> : null}
      <label className={label}>
        {dict.email}
        <input className={input} type="email" name="email" autoComplete="email" required inputMode="email" />
      </label>
      <label className={label}>
        {dict.password}
        <input className={input} type="password" name="password" autoComplete="current-password" required />
      </label>
      <button className={submit} disabled={pending} type="submit">
        {dict.login}
      </button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href={`/${locale}/reset-password`} className="font-semibold text-brand hover:underline">
          {dict.forgot}
        </Link>
        <span>
          {dict.noAccount}{" "}
          <Link href={`/${locale}/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:underline">
            {dict.signup}
          </Link>
        </span>
      </div>
    </form>
  );
}

export function SignUpForm({
  locale,
  dict,
  next,
  legal,
}: {
  locale: string;
  dict: AuthDict;
  next: string;
  legal: { terms: string; privacy: string };
}) {
  const [state, action, pending] = useActionState(signUpAction, {});
  const err = errorText(dict, state);
  if (state.ok === "check_email") return <Alert tone="success">{dict.checkEmail}</Alert>;
  return (
    <form action={action} className="space-y-4" data-testid="signup-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      {err ? <Alert>{err}</Alert> : null}
      <label className={label}>
        {dict.displayName}
        <input className={input} type="text" name="displayName" autoComplete="nickname" maxLength={80} />
      </label>
      <label className={label}>
        {dict.email}
        <input className={input} type="email" name="email" autoComplete="email" required inputMode="email" />
      </label>
      <label className={label}>
        {dict.password}
        <input className={input} type="password" name="password" autoComplete="new-password" required minLength={8} aria-describedby="pw-hint" />
        <span id="pw-hint" className="mt-1 block text-xs font-normal text-muted">
          {dict.passwordHint}
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 accent-[var(--c-primary-strong)]" />
        <span>
          {dict.consent}{" "}
          <Link href={`/${locale}/terms`} className="text-brand underline" target="_blank">
            {legal.terms}
          </Link>{" "}
          ·{" "}
          <Link href={`/${locale}/privacy`} className="text-brand underline" target="_blank">
            {legal.privacy}
          </Link>
        </span>
      </label>
      <button className={submit} disabled={pending} type="submit">
        {dict.signup}
      </button>
      <p className="text-sm">
        {dict.haveAccount}{" "}
        <Link href={`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:underline">
          {dict.login}
        </Link>
      </p>
    </form>
  );
}

export function ResetRequestForm({ locale, dict }: { locale: string; dict: AuthDict }) {
  const [state, action, pending] = useActionState(requestResetAction, {});
  if (state.ok === "reset_sent") return <Alert tone="success">{dict.resetSent}</Alert>;
  const err = errorText(dict, state);
  return (
    <form action={action} className="space-y-4" data-testid="reset-form">
      <input type="hidden" name="locale" value={locale} />
      {err ? <Alert>{err}</Alert> : null}
      <label className={label}>
        {dict.email}
        <input className={input} type="email" name="email" autoComplete="email" required />
      </label>
      <button className={submit} disabled={pending} type="submit">
        {dict.resetSend}
      </button>
    </form>
  );
}

export function UpdatePasswordForm({ locale, dict }: { locale: string; dict: AuthDict }) {
  const [state, action, pending] = useActionState(updatePasswordAction, {});
  if (state.ok === "password_updated")
    return (
      <div className="space-y-4">
        <Alert tone="success">{dict.passwordUpdated}</Alert>
        <Link href={`/${locale}/my-practice`} className={submit}>
          OK
        </Link>
      </div>
    );
  const err = errorText(dict, state);
  return (
    <form action={action} className="space-y-4" data-testid="update-password-form">
      <input type="hidden" name="locale" value={locale} />
      {err ? <Alert>{state.error === "credentials" ? dict.linkInvalid : err}</Alert> : null}
      <label className={label}>
        {dict.newPassword}
        <input className={input} type="password" name="password" autoComplete="new-password" required minLength={8} />
        <span className="mt-1 block text-xs font-normal text-muted">{dict.passwordHint}</span>
      </label>
      <button className={submit} disabled={pending} type="submit">
        {dict.setPassword}
      </button>
    </form>
  );
}
