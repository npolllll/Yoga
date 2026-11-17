import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";

/** Side-by-side RU | EN preview at phone width (390 px). */
export default async function PreviewBoth({ params }: PageProps<"/[locale]/admin/preview/[id]/both">) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return (
    <div className="flex flex-wrap justify-center gap-6" data-testid="preview-both-page">
      {(["ru", "en"] as const).map((l) => (
        <figure key={l} className="text-center">
          <figcaption className="mb-2 text-sm font-bold uppercase">{l}</figcaption>
          <iframe title={`preview-${l}`} src={`/${l}/admin/preview/${id}`} className="h-[80vh] w-[390px] rounded-[var(--radius-md)] border border-line bg-bg shadow-lift" />
        </figure>
      ))}
    </div>
  );
}
