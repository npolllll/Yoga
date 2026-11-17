import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";

const ROOT = join(__dirname, "..", "..");
const envFile = join(ROOT, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;
export const PASSWORD = "Test-password-123";

export type DB = SupabaseClient<Database>;

export const admin: DB = createClient<Database>(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
export const anon = (): DB => createClient<Database>(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const run = Math.random().toString(36).slice(2, 8);

export async function userWithRoles(name: string, roles: ("reviewer" | "editor" | "owner")[] = []): Promise<{ id: string; email: string; client: DB }> {
  const email = `${name}-${run}@test.balance.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  for (const role of roles) {
    const r = await admin.from("user_roles").insert({ user_id: data.user.id, role });
    if (r.error) throw r.error;
  }
  const client = anon();
  const s = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (s.error) throw s.error;
  return { id: data.user.id, email, client };
}

export async function cleanupUsers() {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of data?.users ?? []) {
    if (u.email?.endsWith(`-${run}@test.balance.local`)) await admin.auth.admin.deleteUser(u.id);
  }
}

export async function setAllowUnreviewed(value: boolean) {
  await admin.from("site_settings").update({ allow_unreviewed_publish: value }).eq("id", 1);
}

export const uuid = () => crypto.randomUUID();
export const L = (ru: string, en: string) => ({ ru, en });

export function programDraft(stepKeys: string[], title = "Test program") {
  return {
    title: L(title, title),
    summary: L("s", "s"),
    description: L("d", "d"),
    audience: L("a", "a"),
    prerequisites: [],
    goals: [],
    safety: [],
    steps: stepKeys.map((key, i) => ({ key, kind: "lesson", title: L(`Шаг ${i + 1}`, `Step ${i + 1}`), body: L("Текст", "Text") })),
  };
}
