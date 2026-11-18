"use server";

import { revalidateTag, updateTag } from "next/cache";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { DOC_SCHEMAS, type DocType, SlugSchema } from "@/lib/content/schema";
import { normalizeKeys } from "@/lib/content/step-keys";
import { hasErrors, type Issue } from "@/lib/content/validate";
import { issuesFor } from "@/lib/content/issues";
import { TAGS } from "@/lib/data/public";
import type { Json, Database } from "@/lib/supabase/database.types";

type JsonValue = NonNullable<Json>;
type MediaUpdate = Database["public"]["Tables"]["media_assets"]["Update"];

type Fail = { ok: false; error: string; issues?: Issue[] };
type Ok<T = object> = { ok: true } & T;

async function staff(requireEdit = true) {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { supabase, userId: null, roles: [] as string[], allowed: false };
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const list = (roles ?? []).map((r) => r.role as string);
  const allowed = requireEdit ? list.includes("editor") || list.includes("owner") : list.length > 0;
  return { supabase, userId, roles: list, allowed };
}

function bust(type: DocType, slug?: string) {
  // Read-your-own-writes for the editor; visitors get fresh data on their next request.
  updateTag(TAGS.catalog);
  updateTag(TAGS.media);
  if (type === "program") updateTag(TAGS.programs);
  if (type === "exercise") updateTag(TAGS.exercises);
  if (type === "page" && slug) updateTag(TAGS.page(slug));
  if (type === "pose" && slug) updateTag(TAGS.pose(slug));
}

const Meta = z.object({
  slug: SlugSchema,
  category_key: z.string().nullable().optional(),
  level_key: z.string().nullable().optional(),
  skill_keys: z.array(z.string()).max(20).default([]),
  sort_weight: z.number().int().min(-1000).max(10000).default(0),
});

export async function createDocument(type: DocType, slug: string): Promise<Ok<{ id: string }> | Fail> {
  const { supabase, allowed } = await staff();
  if (!allowed) return { ok: false, error: "forbidden" };
  if (!SlugSchema.safeParse(slug).success) return { ok: false, error: "invalid_slug" };
  const empty = { ru: "", en: "" };
  const drafts: Record<DocType, unknown> = {
    pose: { name: empty, sanskrit: "", summary: empty, about: empty },
    program: { title: empty, summary: empty, description: empty, audience: empty },
    exercise: { name: empty, summary: empty },
    page: { title: empty },
  };
  const draft = DOC_SCHEMAS[type].parse(drafts[type]);
  const { data, error } = await supabase.from("documents").insert({ type, slug, draft: draft as JsonValue }).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? "slug_taken" : error.message };
  return { ok: true, id: data.id };
}

export async function saveDocument(input: {
  id: string;
  type: DocType;
  revision: number;
  draft: unknown;
  meta: z.input<typeof Meta>;
}): Promise<Ok<{ revision: number; issues: Issue[] }> | Fail> {
  const { supabase, allowed } = await staff();
  if (!allowed) return { ok: false, error: "forbidden" };
  const meta = Meta.safeParse(input.meta);
  if (!meta.success) return { ok: false, error: "invalid_meta" };
  const parsed = DOC_SCHEMAS[input.type].safeParse(input.draft);
  if (!parsed.success) {
    return { ok: false, error: "invalid_document", issues: parsed.error.issues.map((i) => ({ level: "error", field: i.path.join("."), code: i.message })) };
  }
  const draft = parsed.data as Record<string, unknown>;
  if (input.type === "program") draft.steps = normalizeKeys(draft.steps as { key: string }[]);
  if (input.type === "pose") draft.steps = normalizeKeys(draft.steps as { key: string }[]);
  // Optimistic concurrency: only update if nobody saved in between.
  const { data, error } = await supabase
    .from("documents")
    .update({
      draft: draft as JsonValue,
      slug: meta.data.slug,
      category_key: meta.data.category_key ?? null,
      level_key: meta.data.level_key ?? null,
      skill_keys: meta.data.skill_keys,
      sort_weight: meta.data.sort_weight,
    })
    .eq("id", input.id)
    .eq("revision", input.revision)
    .select("revision")
    .maybeSingle();
  if (error) return { ok: false, error: error.code === "23505" ? "slug_taken" : error.message };
  if (!data) return { ok: false, error: "conflict" };
  return { ok: true, revision: data.revision, issues: issuesFor(input.type, draft, meta.data) };
}

export async function publishDocument(id: string, note?: string): Promise<Ok<{ version: number }> | Fail> {
  const { supabase, allowed } = await staff();
  if (!allowed) return { ok: false, error: "forbidden" };
  const { data: doc } = await supabase.from("documents").select("type, slug, draft, category_key, level_key, skill_keys, sort_weight").eq("id", id).single();
  if (!doc) return { ok: false, error: "not_found" };
  const issues = issuesFor(doc.type, doc.draft, { category_key: doc.category_key, level_key: doc.level_key, skill_keys: doc.skill_keys });
  if (hasErrors(issues)) return { ok: false, error: "incomplete", issues };
  const { data, error } = await supabase.rpc("publish_document", { p_document_id: id, p_note: note ?? undefined });
  if (error) return { ok: false, error: error.message };
  bust(doc.type, doc.slug);
  return { ok: true, version: data as number };
}

export async function unpublishDocument(id: string): Promise<Ok | Fail> {
  const { supabase, allowed } = await staff();
  if (!allowed) return { ok: false, error: "forbidden" };
  const { data: doc } = await supabase.from("documents").select("type, slug").eq("id", id).single();
  const { error } = await supabase.rpc("unpublish_document", { p_document_id: id });
  if (error) return { ok: false, error: error.message };
  if (doc) bust(doc.type, doc.slug);
  return { ok: true };
}

const Status = z.enum(["draft", "editorial_review", "expert_review", "approved"]);

export async function setReviewStatus(id: string, status: string, comment?: string): Promise<Ok | Fail> {
  const { supabase, allowed } = await staff(false);
  if (!allowed) return { ok: false, error: "forbidden" };
  const s = Status.safeParse(status);
  if (!s.success) return { ok: false, error: "invalid" };
  const { error } = await supabase.rpc("set_review_status", { p_document_id: id, p_status: s.data, p_comment: comment?.slice(0, 4000) || undefined });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function addReviewComment(id: string, comment: string): Promise<Ok | Fail> {
  const { supabase, userId, allowed } = await staff(false);
  if (!allowed || !userId) return { ok: false, error: "forbidden" };
  const text = comment.trim().slice(0, 4000);
  if (!text) return { ok: false, error: "invalid" };
  const { data: doc } = await supabase.from("documents").select("revision").eq("id", id).single();
  const { error } = await supabase.from("reviews").insert({ document_id: id, revision: doc?.revision ?? 0, reviewer_id: userId, kind: "editorial", decision: "comment", comment: text });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function restoreVersion(id: string, version: number): Promise<Ok | Fail> {
  const { supabase, allowed } = await staff();
  if (!allowed) return { ok: false, error: "forbidden" };
  const { error } = await supabase.rpc("restore_version", { p_document_id: id, p_version_no: version });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function duplicateDocument(id: string): Promise<Ok<{ id: string }> | Fail> {
  const { supabase, allowed } = await staff();
  if (!allowed) return { ok: false, error: "forbidden" };
  const { data: doc } = await supabase.from("documents").select("*").eq("id", id).single();
  if (!doc) return { ok: false, error: "not_found" };
  const draft = structuredClone(doc.draft) as Record<string, unknown>;
  // A copy is a new entity: every step gets a NEW key (progress never transfers to copies).
  if (Array.isArray(draft.steps)) draft.steps = (draft.steps as { key: string }[]).map((s) => ({ ...s, key: crypto.randomUUID() }));
  let slug = `${doc.slug}-copy`;
  for (let i = 2; i < 50; i++) {
    const { data: exists } = await supabase.from("documents").select("id").eq("type", doc.type).eq("slug", slug).maybeSingle();
    if (!exists) break;
    slug = `${doc.slug}-copy-${i}`;
  }
  const { data, error } = await supabase
    .from("documents")
    .insert({ type: doc.type, slug, draft: draft as JsonValue, category_key: doc.category_key, level_key: doc.level_key, skill_keys: doc.skill_keys, sort_weight: doc.sort_weight })
    .select("id")
    .single();
  return error ? { ok: false, error: error.message } : { ok: true, id: data.id };
}

export async function deleteDocument(id: string): Promise<Ok | Fail> {
  const { supabase, roles } = await staff();
  if (!roles.includes("owner")) return { ok: false, error: "forbidden" };
  const { data: doc } = await supabase.from("documents").select("type, slug").eq("id", id).single();
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (doc) bust(doc.type, doc.slug);
  return { ok: true };
}

export async function stepCompletionCounts(programId: string): Promise<Record<string, number>> {
  const { supabase, allowed } = await staff(false);
  if (!allowed) return {};
  const { data } = await supabase.rpc("step_completion_counts", { p_program_id: programId });
  return Object.fromEntries((data ?? []).map((r: { step_key: string; completions: number }) => [r.step_key, Number(r.completions)]));
}

// ----------------------------------------------------------------------------------------------
// Settings, taxonomy, roles
// ----------------------------------------------------------------------------------------------
const Loc = z.object({ ru: z.string().max(200), en: z.string().max(200) });
const Settings = z.object({
  levelLabelOverrides: z.record(z.string(), Loc),
  contact: z.object({
    email: z.email().nullable(),
    socials: z.array(z.object({ label: z.string().min(1).max(40), url: z.url() })).max(10),
  }),
  allowUnreviewedPublish: z.boolean(),
});

export async function saveSettings(input: z.input<typeof Settings>): Promise<Ok | Fail> {
  const { supabase, roles } = await staff();
  if (!roles.includes("owner")) return { ok: false, error: "forbidden" };
  const s = Settings.safeParse(input);
  if (!s.success) return { ok: false, error: "invalid" };
  const { data: current } = await supabase.from("site_settings").select("data").eq("id", 1).single();
  const data = { ...((current?.data as object) ?? {}), levelLabelOverrides: s.data.levelLabelOverrides, contact: s.data.contact };
  const { error } = await supabase.from("site_settings").update({ data: data as JsonValue, allow_unreviewed_publish: s.data.allowUnreviewedPublish }).eq("id", 1);
  if (error) return { ok: false, error: error.message };
  updateTag(TAGS.settings);
  updateTag(TAGS.taxonomy);
  return { ok: true };
}

/**
 * Owner-only escape hatch: expire every public cache tag. Needed only in a rare race where a page
 * regeneration that started before a publish finishes after it and caches the old version (docs/DECISIONS.md).
 */
export async function refreshPublicCache(): Promise<Ok | Fail> {
  const { supabase, roles } = await staff();
  if (!roles.includes("owner")) return { ok: false, error: "forbidden" };
  const { data } = await supabase.from("publications").select("type, slug");
  for (const tag of [TAGS.catalog, TAGS.media, TAGS.programs, TAGS.exercises, TAGS.taxonomy, TAGS.settings]) updateTag(tag);
  for (const p of data ?? []) {
    if (p.type === "pose") updateTag(TAGS.pose(p.slug));
    else if (p.type === "page") updateTag(TAGS.page(p.slug));
    else if (p.type === "program") updateTag(TAGS.program(p.slug));
  }
  return { ok: true };
}

const TaxItem = z.object({ key: z.string().regex(/^[a-z0-9-]+$/), name: Loc, description: Loc.optional() });

export async function saveTaxonomyItem(kind: "categories" | "skills" | "levels", item: z.input<typeof TaxItem>): Promise<Ok | Fail> {
  const { supabase, allowed } = await staff();
  if (!allowed) return { ok: false, error: "forbidden" };
  const v = TaxItem.safeParse(item);
  if (!v.success) return { ok: false, error: "invalid" };
  const res =
    kind === "levels"
      ? await supabase.from("levels").update({ label: v.data.name, description: v.data.description ?? { ru: "", en: "" } }).eq("key", v.data.key)
      : kind === "categories"
        ? await supabase.from("categories").update({ name: v.data.name, description: v.data.description ?? { ru: "", en: "" } }).eq("key", v.data.key)
        : await supabase.from("skills").update({ name: v.data.name }).eq("key", v.data.key);
  if (res.error) return { ok: false, error: res.error.message };
  updateTag(TAGS.taxonomy);
  return { ok: true };
}

export async function setUserRole(email: string, role: "reviewer" | "editor" | "owner", grant: boolean): Promise<Ok | Fail> {
  const { supabase, userId, roles } = await staff();
  if (!roles.includes("owner")) return { ok: false, error: "forbidden" };
  if (!["reviewer", "editor", "owner"].includes(role)) return { ok: false, error: "invalid" };
  // Owner-only operation: resolve the user by email with the privileged client after the check above.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
  if (!user) return { ok: false, error: "user_not_found" };
  if (!grant && user.id === userId && role === "owner") return { ok: false, error: "cannot_revoke_own_owner" };
  const res = grant
    ? await supabase.from("user_roles").upsert({ user_id: user.id, role, granted_by: userId }, { onConflict: "user_id,role", ignoreDuplicates: true })
    : await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", role);
  return res.error ? { ok: false, error: res.error.message } : { ok: true };
}

// ----------------------------------------------------------------------------------------------
// Media library
// ----------------------------------------------------------------------------------------------
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/avif", "video/mp4", "video/webm"];

export async function uploadMedia(form: FormData): Promise<Ok<{ id: string; url: string }> | Fail> {
  const { supabase, userId, allowed } = await staff();
  if (!allowed) return { ok: false, error: "forbidden" };
  const file = form.get("file");
  const documentId = (form.get("documentId") as string) || null;
  const kind = String(form.get("kind") || "image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "no_file" };
  if (!ALLOWED.includes(file.type)) return { ok: false, error: "type" };
  if (file.size > 50 * 1024 * 1024) return { ok: false, error: "too_large" };
  if (!["animation", "poster", "keyframe", "card", "image", "illustration"].includes(kind)) return { ok: false, error: "invalid" };
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `uploads/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const up = await supabase.storage.from("media").upload(path, bytes, { contentType: file.type, upsert: false });
  if (up.error) return { ok: false, error: up.error.message };
  const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
  const digest = Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");
  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      document_id: documentId,
      kind,
      url: pub.publicUrl,
      storage_path: path,
      mime: file.type,
      bytes: file.size,
      sha256: digest,
      alt: { ru: String(form.get("altRu") || ""), en: String(form.get("altEn") || "") },
      width: Number(form.get("width")) || null,
      height: Number(form.get("height")) || null,
      position: Number(form.get("position")) || 0,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateTag(TAGS.media, "max");
  return { ok: true, id: data.id, url: pub.publicUrl };
}

export async function updateMedia(id: string, patch: { alt?: { ru: string; en: string }; checkStatus?: string; documentId?: string | null; position?: number }): Promise<Ok | Fail> {
  const { supabase, allowed } = await staff();
  if (!allowed) return { ok: false, error: "forbidden" };
  const upd: MediaUpdate = {};
  if (patch.alt) upd.alt = { ru: patch.alt.ru.slice(0, 300), en: patch.alt.en.slice(0, 300) };
  // "expert_approved" can never be set from the media library: approval belongs to the reviewer workflow.
  if (patch.checkStatus && ["unchecked", "auto_passed", "auto_failed", "visual_ok"].includes(patch.checkStatus)) upd.check_status = patch.checkStatus;
  if (patch.documentId !== undefined) upd.document_id = patch.documentId;
  if (patch.position !== undefined) upd.position = patch.position;
  const { error } = await supabase.from("media_assets").update(upd).eq("id", id);
  if (error) return { ok: false, error: error.message };
  updateTag(TAGS.media);
  return { ok: true };
}

export async function deleteMedia(id: string): Promise<Ok | Fail> {
  const { supabase, allowed } = await staff();
  if (!allowed) return { ok: false, error: "forbidden" };
  const { data: row } = await supabase.from("media_assets").select("storage_path").eq("id", id).single();
  if (row?.storage_path) await supabase.storage.from("media").remove([row.storage_path]);
  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  updateTag(TAGS.media);
  return { ok: true };
}
