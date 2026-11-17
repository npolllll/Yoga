import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AdminGate } from "@/components/admin/AdminGate";
import { MediaRow, MediaUpload } from "@/components/admin/AdminForms";
import { adminClient } from "@/lib/admin/data";
import { mediaUrl } from "@/lib/media";
import { t } from "@/lib/i18n/paths";

export default async function MediaLibrary({ params }: PageProps<"/[locale]/admin/media">) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const labels = { ...(dict.admin as unknown as Record<string, string>), save: dict.common.save };
  return (
    <AdminGate locale={locale} need="editor">
      {async () => {
        const db = await adminClient();
        const [{ data: media }, { data: docs }] = await Promise.all([
          db.from("media_assets").select("*").order("created_at", { ascending: false }).limit(300),
          db.from("documents").select("id, type, slug, draft").order("slug"),
        ]);
        const docLabel = new Map((docs ?? []).map((d) => [d.id, `${d.type}: ${t((d.draft as { name?: { ru: string; en: string } }).name, locale) || d.slug}`]));
        return (
          <div className="space-y-6" data-testid="admin-media">
            <h1 className="text-3xl">{dict.admin.media}</h1>
            <MediaUpload documents={[...docLabel].map(([id, label]) => ({ id, label }))} labels={labels} />
            <ul className="grid gap-4 md:grid-cols-2">
              {(media ?? []).map((m) => (
                <li key={m.id} className="grid grid-cols-[120px_1fr] gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-3">
                  <div className="overflow-hidden rounded bg-surface-2">
                    {m.mime.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                      <img src={mediaUrl(m.url)} alt="" className="aspect-[4/3] w-full object-contain" loading="lazy" />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center text-xs">{m.mime}</div>
                    )}
                  </div>
                  <div className="min-w-0 text-xs">
                    <p className="truncate font-semibold">
                      {m.kind} · {m.document_id ? docLabel.get(m.document_id) : "—"}
                    </p>
                    <p className="truncate text-muted">
                      {m.width && m.height ? `${m.width}×${m.height} · ` : ""}
                      {m.bytes ? `${Math.round(m.bytes / 1024)} KiB · ` : ""}
                      {m.duration_ms ? `${m.duration_ms / 1000}s · ` : ""}
                      v{m.version} · {m.check_status}
                    </p>
                    <div className="mt-2">
                      <MediaRow id={m.id} alt={{ ru: (m.alt as { ru?: string }).ru ?? "", en: (m.alt as { en?: string }).en ?? "" }} checkStatus={m.check_status} labels={labels} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      }}
    </AdminGate>
  );
}
