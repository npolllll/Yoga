/**
 * Imports content from ./content into Supabase through the REAL application paths:
 * an editor account saves drafts (RLS) and publishes via publish_document().
 *
 *   pnpm db:seed                 dev/staging: test users + content + media metadata
 *   pnpm db:seed --content-only  import content only (no test users), e.g. for a fresh staging
 *
 * Refuses to run against a non-local Supabase unless --allow-remote is passed.
 * Test users are created ONLY for local/staging use; never run with test users in production.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { PoseDoc, ProgramDoc, ExerciseDoc, PageDoc } from "../src/lib/content/schema";
import { normalizeKeys } from "../src/lib/content/step-keys";

const ROOT = join(__dirname, "..");
const args = new Set(process.argv.slice(2));

function loadEnv() {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;
if (!URL_ || !ANON || !SECRET) throw new Error("Missing Supabase env (see .env.example)");
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(URL_);
if (!isLocal && !args.has("--allow-remote")) {
  console.error(`Refusing to seed remote project ${URL_} without --allow-remote`);
  process.exit(1);
}

export const SEED_PASSWORD = process.env.SEED_PASSWORD || "Balance-dev-2026";
export const SEED_USERS = [
  { email: "owner@balance.local", roles: ["owner", "editor"] as const, name: "Owner" },
  { email: "editor@balance.local", roles: ["editor"] as const, name: "Editor" },
  { email: "reviewer@balance.local", roles: ["reviewer"] as const, name: "Reviewer" },
  { email: "member@balance.local", roles: [] as const, name: "Member" },
];

const admin = createClient<Database>(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

async function ensureUser(email: string, name: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name, locale: "ru" },
  });
  if (error) throw error;
  return data.user.id;
}

async function signIn(email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return client;
}

function readDir(dir: string): Record<string, unknown>[] {
  const path = join(ROOT, "content", dir);
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(path, f), "utf8")));
}

type DocType = Database["public"]["Enums"]["doc_type"];

async function upsertAndPublish(
  editor: SupabaseClient<Database>,
  type: DocType,
  slug: string,
  draft: unknown,
  meta: { category_key?: string | null; level_key?: string | null; skill_keys?: string[]; sort_weight?: number },
): Promise<string> {
  const { data: existing } = await editor.from("documents").select("id").eq("type", type).eq("slug", slug).maybeSingle();
  let id = existing?.id;
  const row = {
    type,
    slug,
    draft: draft as Database["public"]["Tables"]["documents"]["Insert"]["draft"],
    category_key: meta.category_key ?? null,
    level_key: meta.level_key ?? null,
    skill_keys: meta.skill_keys ?? [],
    sort_weight: meta.sort_weight ?? 0,
  };
  if (id) {
    const { error } = await editor.from("documents").update(row).eq("id", id);
    if (error) throw new Error(`update ${type}/${slug}: ${error.message}`);
  } else {
    const { data, error } = await editor.from("documents").insert(row).select("id").single();
    if (error) throw new Error(`insert ${type}/${slug}: ${error.message}`);
    id = data.id;
  }
  const { error: pubErr } = await editor.rpc("publish_document", { p_document_id: id!, p_note: "seed import" });
  if (pubErr) throw new Error(`publish ${type}/${slug}: ${pubErr.message}`);
  return id!;
}

interface MediaManifest {
  slug: string;
  items: {
    kind: string;
    url: string;
    mime: string;
    width?: number;
    height?: number;
    durationMs?: number;
    frameCount?: number;
    fps?: number;
    bytes?: number;
    sha256?: string;
    position?: number;
    alt?: { ru?: string; en?: string };
    checkStatus?: string;
    meta?: Record<string, unknown>;
  }[];
}

async function importMedia(type: "pose" | "exercise", ids: Map<string, string>) {
  const base = join(ROOT, "public", "media", type === "pose" ? "poses" : "exercises");
  if (!existsSync(base)) return 0;
  let count = 0;
  for (const slug of readdirSync(base)) {
    const manifestPath = join(base, slug, "manifest.json");
    const docId = ids.get(slug);
    if (!docId || !existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as MediaManifest;
    await admin.from("media_assets").delete().eq("document_id", docId);
    const rows = manifest.items.map((m) => ({
      document_id: docId,
      kind: m.kind,
      url: m.url,
      mime: m.mime,
      width: m.width ?? null,
      height: m.height ?? null,
      duration_ms: m.durationMs ?? null,
      frame_count: m.frameCount ?? null,
      fps: m.fps ?? null,
      bytes: m.bytes ?? null,
      sha256: m.sha256 ?? null,
      position: m.position ?? 0,
      alt: m.alt ?? {},
      check_status: m.checkStatus ?? "unchecked",
      meta: (m.meta ?? {}) as Database["public"]["Tables"]["media_assets"]["Insert"]["meta"],
    }));
    const { error } = await admin.from("media_assets").insert(rows);
    if (error) throw new Error(`media ${slug}: ${error.message}`);
    count += rows.length;
  }
  return count;
}

async function main() {
  const contentOnly = args.has("--content-only");
  const ids: Record<string, string> = {};
  for (const u of SEED_USERS) {
    if (contentOnly && u.email !== "editor@balance.local") continue;
    ids[u.email] = await ensureUser(u.email, u.name);
    for (const role of u.roles) {
      await admin.from("user_roles").upsert({ user_id: ids[u.email], role }, { onConflict: "user_id,role", ignoreDuplicates: true });
    }
  }
  if (!contentOnly) console.log(`users: ${SEED_USERS.map((u) => u.email).join(", ")} (password from SEED_PASSWORD)`);

  // Dev/staging: allow publishing content that has not been reviewed by a teacher (pages show a notice).
  await admin.from("site_settings").update({ allow_unreviewed_publish: true }).eq("id", 1);

  const editor = await signIn("editor@balance.local");

  const exerciseIds = new Map<string, string>();
  for (const raw of readDir("exercises")) {
    const doc = ExerciseDoc.parse(raw.doc);
    exerciseIds.set(raw.slug as string, await upsertAndPublish(editor, "exercise", raw.slug as string, doc, { skill_keys: (raw.skills as string[]) ?? [] }));
  }
  console.log(`exercises: ${exerciseIds.size}`);

  const poseIds = new Map<string, string>();
  for (const raw of readDir("poses")) {
    const doc = PoseDoc.parse(raw.doc);
    doc.steps = normalizeKeys(doc.steps);
    poseIds.set(
      raw.slug as string,
      await upsertAndPublish(editor, "pose", raw.slug as string, doc, {
        category_key: raw.category as string,
        level_key: raw.level as string,
        skill_keys: raw.skills as string[],
        sort_weight: (raw.sortWeight as number) ?? 50,
      }),
    );
  }
  console.log(`poses: ${poseIds.size}`);

  let programs = 0;
  for (const raw of readDir("programs")) {
    const steps = (raw.doc as { steps: Record<string, unknown>[] }).steps.map((s) => {
      const { poseSlug, exerciseSlug, ...rest } = s as { poseSlug?: string; exerciseSlug?: string };
      const out: Record<string, unknown> = { ...rest };
      if (poseSlug) {
        out.poseId = poseIds.get(poseSlug);
        if (!out.poseId) throw new Error(`program ${raw.slug}: unknown pose ${poseSlug}`);
      }
      if (exerciseSlug) {
        out.exerciseId = exerciseIds.get(exerciseSlug);
        if (!out.exerciseId) throw new Error(`program ${raw.slug}: unknown exercise ${exerciseSlug}`);
      }
      return out;
    });
    const doc = ProgramDoc.parse({ ...(raw.doc as object), steps });
    await upsertAndPublish(editor, "program", raw.slug as string, doc, {
      level_key: raw.level as string,
      sort_weight: (raw.sortWeight as number) ?? 0,
    });
    programs++;
  }
  console.log(`programs: ${programs}`);

  let pages = 0;
  for (const raw of readDir("pages")) {
    await upsertAndPublish(editor, "page", raw.slug as string, PageDoc.parse(raw.doc), {});
    pages++;
  }
  console.log(`pages: ${pages}`);

  console.log(`media rows: ${await importMedia("pose", poseIds)} (poses), ${await importMedia("exercise", exerciseIds)} (exercises)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
