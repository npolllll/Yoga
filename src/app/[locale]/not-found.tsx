import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { locale as rootLocale } from "next/root-params";
import { isLocale } from "@/lib/i18n/config";

export default async function NotFound() {
  const raw = await rootLocale();
  const locale = isLocale(raw) ? raw : "ru";
  const dict = getDictionary(locale);
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="ornament text-sm font-semibold">404</p>
      <h1 className="mt-4 text-4xl">{dict.common.notFoundTitle}</h1>
      <p className="mt-3 text-muted">{dict.common.notFoundText}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={`/${locale}`} className={buttonClass("dark")}>
          {dict.common.toHome}
        </Link>
        <Link href={`/${locale}/poses`} className={buttonClass("secondary")}>
          {dict.nav.poses}
        </Link>
      </div>
    </section>
  );
}
