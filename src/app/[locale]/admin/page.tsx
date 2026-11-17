import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AdminGate } from "@/components/admin/AdminGate";
import { listDocuments, adminClient } from "@/lib/admin/data";
import { t } from "@/lib/i18n/paths";

export default async function AdminDashboard({ params }: PageProps<"/[locale]/admin">) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const a = dict.admin;
  return (
    <AdminGate locale={locale}>
      {async () => {
        const db = await adminClient();
        const [docs, levels, categories, audit] = await Promise.all([
          listDocuments(),
          db.from("levels").select("key, label").order("position"),
          db.from("categories").select("key, name").order("position"),
          db.from("audit_log").select("id, action, entity_type, entity_id, meta, created_at").order("id", { ascending: false }).limit(12),
        ]);
        const poses = docs.filter((d) => d.type === "pose");
        const awaiting = docs.filter((d) => d.reviewStatus === "editorial_review" || d.reviewStatus === "expert_review");
        const stat = [
          [a.poses, poses.length, poses.filter((p) => p.published).length],
          [a.programs, docs.filter((d) => d.type === "program").length, docs.filter((d) => d.type === "program" && d.published).length],
          [a.missingMedia, poses.filter((p) => !p.hasAnimation).length, null],
          [a.missingVideo, poses.filter((p) => !p.hasVideo.ru || !p.hasVideo.en).length, null],
          [a.expertApproved, docs.filter((d) => d.published?.expertApproved).length, null],
        ] as const;
        return (
          <div className="space-y-8" data-testid="admin-dashboard">
            <h1 className="text-3xl">{a.dashboard}</h1>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {stat.map(([label, n, pub]) => (
                <li key={label} className="rounded-[var(--radius-md)] border border-line bg-surface p-4">
                  <p className="font-serif text-3xl">{n}</p>
                  <p className="text-sm text-muted">
                    {label}
                    {pub !== null ? ` · ${a.published.toLowerCase()}: ${pub}` : ""}
                  </p>
                </li>
              ))}
            </ul>

            <section>
              <h2 className="text-xl">{a.completeness}</h2>
              <div className="mt-3 overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="p-3" />
                      {(levels.data ?? []).map((l) => (
                        <th key={l.key} className="p-3 font-semibold">
                          {t(l.label as { ru: string; en: string }, locale)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(categories.data ?? []).map((c) => (
                      <tr key={c.key} className="border-b border-line last:border-0">
                        <th className="p-3 text-left font-semibold">{t(c.name as { ru: string; en: string }, locale)}</th>
                        {(levels.data ?? []).map((l) => {
                          const cell = poses.filter((p) => p.categoryKey === c.key && p.levelKey === l.key);
                          const pub = cell.filter((p) => p.published).length;
                          return (
                            <td key={l.key} className={`p-3 ${cell.length === 0 ? "text-muted" : ""}`}>
                              {pub}/{cell.length}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="text-xl">{a.awaitingReview}</h2>
                <ul className="mt-3 space-y-2">
                  {awaiting.length === 0 ? <li className="text-sm text-muted">—</li> : null}
                  {awaiting.map((d) => (
                    <li key={d.id}>
                      <Link href={`/${locale}/admin/edit/${d.id}`} className="flex justify-between rounded-[var(--radius-sm)] border border-line bg-surface p-3 text-sm hover:border-brand">
                        <span className="font-semibold">{t(d.title, locale)}</span>
                        <span className="text-muted">{a.reviewStatus[d.reviewStatus]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="text-xl">{a.recent}</h2>
                <ul className="mt-3 space-y-1 text-sm">
                  {(audit.data ?? []).map((e) => (
                    <li key={e.id} className="flex justify-between gap-3 border-b border-line py-1.5">
                      <span>
                        {e.action} · {e.entity_type} {(e.meta as { slug?: string })?.slug ?? ""}
                      </span>
                      <span className="text-muted">{new Date(e.created_at).toLocaleString(locale)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        );
      }}
    </AdminGate>
  );
}
