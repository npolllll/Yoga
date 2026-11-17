import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AccountPanel } from "@/components/practice/AccountPanel";

export async function generateMetadata({ params }: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).account.title, robots: { index: false } } : {};
}

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <div className="mx-auto max-w-5xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
      <h1 className="text-4xl sm:text-5xl">{dict.account.title}</h1>
      <AccountPanel locale={locale} dict={{ account: dict.account, auth: dict.auth, nav: dict.nav, common: dict.common, actions: dict.actions }} />
    </div>
  );
}
