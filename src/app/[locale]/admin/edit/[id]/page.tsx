import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AdminGate } from "@/components/admin/AdminGate";
import { DocEditor, type EditorDoc } from "@/components/admin/DocEditor";
import { adminClient } from "@/lib/admin/data";
import { MUSCLE_KEYS } from "@/lib/content/schema";
import { t } from "@/lib/i18n/paths";

export default async function EditDocument({ params }: PageProps<"/[locale]/admin/edit/[id]">) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  return (
    <AdminGate locale={locale}>
      {async (user) => {
        const db = await adminClient();
        const { data: doc } = await db.from("documents").select("*").eq("id", id).maybeSingle();
        if (!doc) notFound();
        const [pub, versions, reviews, levels, categories, skills, others, counts] = await Promise.all([
          db.from("publications").select("version_no, source_revision, expert_approved, published_at").eq("document_id", id).maybeSingle(),
          db.from("document_versions").select("version_no, kind, created_at, note").eq("document_id", id).order("version_no", { ascending: false }),
          db.from("reviews").select("id, kind, decision, comment, created_at, revision").eq("document_id", id).order("created_at", { ascending: false }),
          db.from("levels").select("key, label").order("position"),
          db.from("categories").select("key, name").order("position"),
          db.from("skills").select("key, name").order("position"),
          db.from("documents").select("id, type, slug, draft").in("type", ["pose", "exercise"]).order("slug"),
          doc.type === "program" ? db.rpc("step_completion_counts", { p_program_id: id }) : Promise.resolve({ data: [] }),
        ]);
        const label = (o: { slug: string; draft: unknown }) => {
          const d = o.draft as { name?: { ru: string; en: string } };
          return `${t(d.name, locale) || o.slug}`;
        };
        const poseDocs = (others.data ?? []).filter((o) => o.type === "pose");
        const exDocs = (others.data ?? []).filter((o) => o.type === "exercise");
        const opts = {
          muscles: MUSCLE_KEYS.map((k) => ({ value: k, label: dict.muscles[k] })),
          exerciseSlugs: exDocs.map((o) => ({ value: o.slug, label: label(o) })),
          poseSlugs: poseDocs.filter((o) => o.id !== id).map((o) => ({ value: o.slug, label: label(o) })),
          homeKeys: Object.keys(dict.home).filter((k) => typeof (dict.home as Record<string, unknown>)[k] === "string"),
        };
        const editorDoc: EditorDoc = {
          id: doc.id,
          type: doc.type,
          slug: doc.slug,
          revision: doc.revision,
          reviewStatus: doc.review_status,
          draft: doc.draft,
          category_key: doc.category_key,
          level_key: doc.level_key,
          skill_keys: doc.skill_keys,
          sort_weight: doc.sort_weight,
          published: pub.data
            ? { versionNo: pub.data.version_no, sourceRevision: pub.data.source_revision, expertApproved: pub.data.expert_approved, publishedAt: pub.data.published_at }
            : null,
        };
        const title = (doc.draft as { name?: { ru: string; en: string }; title?: { ru: string; en: string } });
        return (
          <div>
            <h1 className="mb-6 text-3xl">{t(title.name ?? title.title, locale) || doc.slug}</h1>
            <DocEditor
              key={`${doc.id}-${doc.revision}`}
              doc={editorDoc}
              ctx={{
                locale,
                roles: user.roles,
                specOptions: opts,
                categories: (categories.data ?? []).map((c) => ({ value: c.key, label: t(c.name as { ru: string; en: string }, locale) })),
                levels: (levels.data ?? []).map((c) => ({ value: c.key, label: t(c.label as { ru: string; en: string }, locale) })),
                skills: (skills.data ?? []).map((c) => ({ value: c.key, label: t(c.name as { ru: string; en: string }, locale) })),
                poses: poseDocs.map((o) => ({ value: o.id, label: label(o) })),
                exercises: exDocs.map((o) => ({ value: o.id, label: label(o) })),
                completionCounts: Object.fromEntries(((counts.data ?? []) as { step_key: string; completions: number }[]).map((r) => [r.step_key, Number(r.completions)])),
                versions: (versions.data ?? []).map((v) => ({ versionNo: v.version_no, kind: v.kind, createdAt: v.created_at, note: v.note })),
                reviews: (reviews.data ?? []).map((r) => ({ id: r.id, kind: r.kind, decision: r.decision, comment: r.comment, createdAt: r.created_at, revision: r.revision })),
                labels: { ...(dict.admin as unknown as Record<string, string>) },
                statusLabels: dict.admin.reviewStatus,
              }}
            />
          </div>
        );
      }}
    </AdminGate>
  );
}
