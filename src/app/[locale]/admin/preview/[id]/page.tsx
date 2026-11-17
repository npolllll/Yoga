import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AdminGate } from "@/components/admin/AdminGate";
import { adminClient } from "@/lib/admin/data";
import { getCatalog, getExercises, getPrograms, getTaxonomy, type MediaItem, type PublishedPose } from "@/lib/data/public";
import { ExerciseDoc, PageDoc, PoseDoc, ProgramDoc } from "@/lib/content/schema";
import { PoseView } from "@/components/pose/PoseView";
import { ContentView } from "@/components/layout/ContentPage";
import { t } from "@/lib/i18n/paths";
import { RichText } from "@/components/ui/RichText";

/** Draft preview with the SAME components as the public pages (staff only, never cached). */
export default async function Preview({ params }: PageProps<"/[locale]/admin/preview/[id]">) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  return (
    <AdminGate locale={locale}>
      {async () => {
        const db = await adminClient();
        const { data: doc } = await db.from("documents").select("*").eq("id", id).maybeSingle();
        if (!doc) notFound();
        const banner = (
          <p className="mb-4 rounded-[var(--radius-sm)] bg-warning-soft p-3 text-sm text-warning" data-testid="preview-banner">
            {dict.admin.previewNotice} · {locale.toUpperCase()}
          </p>
        );
        if (doc.type === "pose") {
          const parsed = PoseDoc.safeParse(doc.draft);
          if (!parsed.success) return <>{banner}<pre className="text-xs">{parsed.error.message}</pre></>;
          const [taxonomy, catalog, exercises, programs, media] = await Promise.all([
            getTaxonomy(),
            getCatalog(),
            getExercises(),
            getPrograms(),
            db.from("media_assets").select("*").eq("document_id", id).order("position"),
          ]);
          const items: MediaItem[] = (media.data ?? []).map((m) => ({
            id: m.id, kind: m.kind, url: m.url, mime: m.mime, width: m.width, height: m.height, durationMs: m.duration_ms,
            alt: (m.alt ?? {}) as { ru?: string; en?: string }, position: m.position, checkStatus: m.check_status, meta: (m.meta ?? {}) as Record<string, unknown>,
          }));
          const d = parsed.data;
          const pose: PublishedPose = {
            id: doc.id, slug: doc.slug, name: d.name, subtitle: d.subtitle ?? null, sanskrit: d.sanskrit, altNames: d.altNames, summary: d.summary,
            categoryKey: doc.category_key ?? "", levelKey: doc.level_key ?? "", skillKeys: doc.skill_keys, sortWeight: doc.sort_weight,
            expertApproved: doc.review_status === "approved", card: null, doc: d, versionNo: 0, publishedAt: doc.updated_at,
            media: {
              animation: items.filter((m) => m.kind === "animation"),
              poster: items.find((m) => m.kind === "poster") ?? null,
              card: items.find((m) => m.kind === "card") ?? null,
              keyframes: items.filter((m) => m.kind === "keyframe"),
            },
          };
          return (
            <>
              {banner}
              <PoseView locale={locale} pose={pose} taxonomy={taxonomy} catalog={catalog} exercises={exercises} programs={programs} preview />
            </>
          );
        }
        if (doc.type === "page") {
          const parsed = PageDoc.safeParse(doc.draft);
          return <>{banner}{parsed.success ? <ContentView doc={parsed.data} locale={locale} slug={doc.slug} contact={{ email: parsed.data.contact?.email ?? null, socials: parsed.data.contact?.socials ?? [] }} /> : null}</>;
        }
        if (doc.type === "program") {
          const parsed = ProgramDoc.safeParse(doc.draft);
          if (!parsed.success) return banner;
          const p = parsed.data;
          return (
            <article className="mx-auto max-w-3xl">
              {banner}
              <h1 className="text-4xl">{t(p.title, locale)}</h1>
              <p className="mt-3 text-lg text-muted">{t(p.summary, locale)}</p>
              <RichText text={t(p.description, locale)} className="mt-6" />
              <ol className="mt-8 space-y-4">
                {p.steps.map((s, i) => (
                  <li key={s.key} className="rounded-[var(--radius-md)] border border-line bg-surface p-4">
                    <p className="text-xs font-bold uppercase text-muted">
                      {i + 1} · {dict.programs.kind[s.kind]}
                    </p>
                    <h2 className="mt-1 text-xl">{t(s.title, locale)}</h2>
                    <RichText text={t(s.body, locale)} className="mt-2 text-muted" />
                  </li>
                ))}
              </ol>
            </article>
          );
        }
        const parsed = ExerciseDoc.safeParse(doc.draft);
        if (!parsed.success) return banner;
        return (
          <article className="mx-auto max-w-3xl">
            {banner}
            <h1 className="text-4xl">{t(parsed.data.name, locale)}</h1>
            <p className="mt-3 text-muted">{t(parsed.data.summary, locale)}</p>
            <ol className="mt-6 list-decimal space-y-2 pl-6">
              {parsed.data.instructions.map((s, i) => (
                <li key={i}>{t(s, locale)}</li>
              ))}
            </ol>
          </article>
        );
      }}
    </AdminGate>
  );
}
