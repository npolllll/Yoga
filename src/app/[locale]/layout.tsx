import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { LOCALES, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { siteUrl } from "@/lib/supabase/env";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ToastProvider } from "@/components/ui/Toast";
import { MemberStateProvider } from "@/components/member/MemberState";
import { AuthPrompt } from "@/components/member/AuthPrompt";
import { getTaxonomy } from "@/lib/data/public";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: dict.meta.defaultTitle, template: `%s · BALANCE` },
    description: dict.meta.defaultDescription,
    applicationName: "BALANCE",
    openGraph: { siteName: "BALANCE", locale: locale === "ru" ? "ru_RU" : "en_US", type: "website" },
    alternates: { languages: { ru: "/ru", en: "/en", "x-default": "/ru" } },
  };
}

export const viewport: Viewport = {
  themeColor: "#fcf9fb",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { settings } = await getTaxonomy();
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a href="#main" className="skip-link">
          {dict.nav.skipToContent}
        </a>
        <ToastProvider>
          <MemberStateProvider dict={dict.actions}>
            <Header locale={locale} dict={dict} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer locale={locale} dict={dict} socials={settings.contact.socials} />
            <AuthPrompt
              locale={locale}
              labels={{
                title: dict.actions.signInToSave,
                text: dict.actions.signInToSaveText,
                signIn: dict.auth.login,
                signUp: dict.auth.signup,
                close: dict.common.close,
              }}
            />
          </MemberStateProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
