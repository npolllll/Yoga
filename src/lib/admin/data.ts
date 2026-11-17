import "server-only";
import { createSessionClient } from "@/lib/supabase/server";
import type { DocType } from "@/lib/content/schema";
import { issuesFor } from "@/lib/content/issues";

export async function adminClient() {
  return createSessionClient();
}

export interface DocRow {
  id: string;
  type: DocType;
  slug: string;
  reviewStatus: "draft" | "editorial_review" | "expert_review" | "approved";
  revision: number;
  title: { ru: string; en: string };
  categoryKey: string | null;
  levelKey: string | null;
  updatedAt: string;
  published: null | { versionNo: number; sourceRevision: number; expertApproved: boolean };
  errors: number;
  warnings: number;
  hasVideo: { ru: boolean; en: boolean };
  hasAnimation: boolean;
}

export async function listDocuments(type?: DocType): Promise<DocRow[]> {
  const db = await createSessionClient();
  let q = db.from("documents").select("id, type, slug, review_status, revision, draft, category_key, level_key, skill_keys, sort_weight, updated_at").order("sort_weight").order("slug");
  if (type) q = q.eq("type", type);
  const [{ data: docs }, { data: pubs }, { data: media }] = await Promise.all([
    q,
    db.from("publications").select("document_id, version_no, source_revision, expert_approved"),
    db.from("media_assets").select("document_id, kind").eq("kind", "animation"),
  ]);
  const pubBy = new Map((pubs ?? []).map((p) => [p.document_id, p]));
  const anim = new Set((media ?? []).map((m) => m.document_id));
  return (docs ?? []).map((d) => {
    const draft = d.draft as Record<string, unknown> & { name?: { ru: string; en: string }; title?: { ru: string; en: string }; video?: { ru?: unknown; en?: unknown } };
    const issues = issuesFor(d.type, d.draft, { category_key: d.category_key, level_key: d.level_key, skill_keys: d.skill_keys });
    const p = pubBy.get(d.id);
    return {
      id: d.id,
      type: d.type,
      slug: d.slug,
      reviewStatus: d.review_status,
      revision: d.revision,
      title: draft.name ?? draft.title ?? { ru: d.slug, en: d.slug },
      categoryKey: d.category_key,
      levelKey: d.level_key,
      updatedAt: d.updated_at,
      published: p ? { versionNo: p.version_no, sourceRevision: p.source_revision, expertApproved: p.expert_approved } : null,
      errors: issues.filter((i) => i.level === "error").length,
      warnings: issues.filter((i) => i.level === "warning").length,
      hasVideo: { ru: !!draft.video?.ru, en: !!draft.video?.en },
      hasAnimation: anim.has(d.id),
    };
  });
}
