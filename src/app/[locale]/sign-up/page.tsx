import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { safeNext } from "@/lib/i18n/paths";
import { AuthShell, FormSkeleton } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/AuthForms";

export async function generateMetadata({ params }: PageProps<"/[locale]/sign-up">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).auth.signupTitle, robots: { index: false } } : {};
}

async function Form({ locale, searchParams }: { locale: "ru" | "en"; searchParams: PageProps<"/[locale]/sign-up">["searchParams"] }) {
  const sp = await searchParams;
  const dict = getDictionary(locale);
  const next = safeNext(typeof sp.next === "string" ? sp.next : null, `/${locale}/my-practice`);
  return <SignUpForm locale={locale} dict={dict.auth} next={next} legal={{ terms: dict.footer.terms, privacy: dict.footer.privacy }} />;
}

export default async function SignUpPage({ params, searchParams }: PageProps<"/[locale]/sign-up">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <AuthShell title={dict.auth.signupTitle} text={dict.actions.signInToSaveText}>
      <Suspense fallback={<FormSkeleton />}>
        <Form locale={locale} searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
