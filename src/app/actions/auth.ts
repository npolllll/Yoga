"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";
import { isLocale } from "@/lib/i18n/config";
import { safeNext } from "@/lib/i18n/paths";

export interface AuthState {
  error?: "invalid" | "credentials" | "weak" | "taken" | "consent" | "rate" | "generic";
  ok?: "check_email" | "reset_sent" | "password_updated";
}

const Email = z.email().max(254);
const Password = z.string().min(8).max(72).regex(/[A-Za-zА-Яа-яЁё]/).regex(/\d/);

function locale(form: FormData) {
  const l = form.get("locale");
  return isLocale(l) ? l : "ru";
}

function mapError(message: string, status?: number): AuthState["error"] {
  if (status === 429 || /rate limit/i.test(message)) return "rate";
  if (/password/i.test(message) && /weak|short|character/i.test(message)) return "weak";
  if (/already|registered|exists/i.test(message)) return "taken";
  if (/invalid login|credentials|not confirmed/i.test(message)) return "credentials";
  return "generic";
}

export async function signInAction(_: AuthState, form: FormData): Promise<AuthState> {
  const l = locale(form);
  const email = Email.safeParse(String(form.get("email") ?? "").trim());
  const password = String(form.get("password") ?? "");
  if (!email.success || !password) return { error: "invalid" };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error) return { error: mapError(error.message, error.status) };
  redirect(safeNext(String(form.get("next") ?? ""), `/${l}/my-practice`));
}

export async function signUpAction(_: AuthState, form: FormData): Promise<AuthState> {
  const l = locale(form);
  const email = Email.safeParse(String(form.get("email") ?? "").trim());
  const password = Password.safeParse(String(form.get("password") ?? ""));
  const displayName = String(form.get("displayName") ?? "").trim().slice(0, 80);
  if (form.get("consent") !== "on") return { error: "consent" };
  if (!email.success) return { error: "invalid" };
  if (!password.success) return { error: "weak" };
  const next = safeNext(String(form.get("next") ?? ""), `/${l}/my-practice`);
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}&confirmed=1`,
      data: { display_name: displayName || null, locale: l },
    },
  });
  if (error) return { error: mapError(error.message, error.status) };
  return { ok: "check_email" };
}

export async function requestResetAction(_: AuthState, form: FormData): Promise<AuthState> {
  const l = locale(form);
  const email = Email.safeParse(String(form.get("email") ?? "").trim());
  if (!email.success) return { error: "invalid" };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(`/${l}/update-password`)}`,
  });
  // Never reveal whether the address exists.
  if (error && (error.status === 429 || /rate limit/i.test(error.message))) return { error: "rate" };
  return { ok: "reset_sent" };
}

export async function updatePasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  const password = Password.safeParse(String(form.get("password") ?? ""));
  if (!password.success) return { error: "weak" };
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "credentials" };
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: mapError(error.message, error.status) };
  return { ok: "password_updated" };
}

export async function signOutAction(form: FormData) {
  const l = locale(form);
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect(`/${l}`);
}
