import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AuthShell } from "@/components/auth/AuthShell";
import { UpdatePasswordForm } from "@/components/auth/AuthForms";

export async function generateMetadata({ params }: PageProps<"/[locale]/update-password">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).auth.newPasswordTitle, robots: { index: false } } : {};
}

export default async function UpdatePasswordPage({ params }: PageProps<"/[locale]/update-password">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <AuthShell title={dict.auth.newPasswordTitle}>
      <UpdatePasswordForm locale={locale} dict={dict.auth} />
    </AuthShell>
  );
}
