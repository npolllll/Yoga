import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { safeNext } from "@/lib/i18n/paths";
import { AuthShell, FormSkeleton } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).auth.loginTitle, robots: { index: false } } : {};
}

async function Form({ locale, searchParams }: { locale: "ru" | "en"; searchParams: PageProps<"/[locale]/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null, `/${locale}/my-practice`);
  return <LoginForm locale={locale} dict={getDictionary(locale).auth} next={next} linkError={sp.error === "link"} />;
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AuthShell title={getDictionary(locale).auth.loginTitle}>
      <Suspense fallback={<FormSkeleton />}>
        <Form locale={locale} searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
