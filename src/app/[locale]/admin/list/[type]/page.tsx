import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AdminGate } from "@/components/admin/AdminGate";
import { CreateDocument } from "@/components/admin/CreateDocument";
import { listDocuments } from "@/lib/admin/data";
import { t } from "@/lib/i18n/paths";
import type { DocType } from "@/lib/content/schema";

const TYPES: DocType[] = ["pose", "program", "exercise", "page"];

export default async function AdminList({ params }: PageProps<"/[locale]/admin/list/[type]">) {
  const { locale: raw, type } = await params;
  if (!isLocale(raw) || !TYPES.includes(type as DocType)) notFound();
  const locale: Locale = raw;
  const a = getDictionary(locale).admin;
  const title = { pose: a.poses, program: a.programs, exercise: a.exercises, page: a.pages }[type as DocType];
  return (
    <AdminGate locale={locale}>
      {async (user) => {
        const docs = await listDocuments(type as DocType);
        const canEdit = user.roles.includes("editor") || user.roles.includes("owner");
        return (
          <div data-testid={`admin-list-${type}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl">{title}</h1>
              {canEdit ? <CreateDocument locale={locale} type={type as DocType} labels={{ create: a.create, slug: a.slug }} /> : null}
            </div>
            {docs.length === 0 ? (
              <p className="mt-6 text-muted">{a.noDocuments}</p>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="p-3">{a.titleCol}</th>
                      <th className="p-3">{a.status}</th>
                      <th className="p-3">RU/EN</th>
                      {type === "pose" ? <th className="p-3">{a.mediaCol}</th> : null}
                      <th className="p-3">{a.updatedCol}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => {
                      const changed = d.published && d.published.sourceRevision !== d.revision;
                      return (
                        <tr key={d.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                          <td className="p-3">
                            <Link href={`/${locale}/admin/edit/${d.id}`} className="font-semibold hover:text-brand" data-slug={d.slug}>
                              {t(d.title, locale) || d.slug}
                            </Link>
                            <div className="font-mono text-xs text-muted">{d.slug}</div>
                          </td>
                          <td className="p-3">
                            <div>{a.reviewStatus[d.reviewStatus]}</div>
                            <div className={`text-xs ${!d.published ? "text-muted" : changed ? "text-warning" : "text-success"}`}>
                              {!d.published ? a.notPublished : changed ? a.publishedChanged : a.published}
                              {d.published ? ` · ${d.published.expertApproved ? a.expertApproved : a.notExpertApproved}` : ""}
                            </div>
                          </td>
                          <td className="p-3">
                            {d.errors === 0 ? <span className="text-success">✓</span> : <span className="text-danger">✕ {d.errors}</span>}
                            {d.warnings > 0 ? <span className="ml-2 text-warning">! {d.warnings}</span> : null}
                          </td>
                          {type === "pose" ? (
                            <td className="p-3 text-xs">
                              {d.hasAnimation ? "🎞" : "—"} · RU {d.hasVideo.ru ? "▶" : "—"} · EN {d.hasVideo.en ? "▶" : "—"}
                            </td>
                          ) : null}
                          <td className="p-3 text-xs text-muted">{new Date(d.updatedAt).toLocaleDateString(locale)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      }}
    </AdminGate>
  );
}
