import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanupUsers, userWithRoles, type DB } from "./helpers";

/**
 * Security boundaries enforced by the database itself (RLS, SECURITY DEFINER checks, storage policies) —
 * independent of what the UI shows or hides.
 */
let member: { id: string; client: DB };
let other: { id: string; client: DB };
let editor: { id: string; client: DB };
let poseId: string;
let programId: string;
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

beforeAll(async () => {
  member = await userWithRoles("sec-member");
  other = await userWithRoles("sec-other");
  editor = await userWithRoles("sec-editor", ["editor"]);
  poseId = (await anon().from("publications").select("document_id").eq("type", "pose").limit(1).single()).data!.document_id;
  programId = (await anon().from("publications").select("document_id").eq("type", "program").limit(1).single()).data!.document_id;
  // The other user has some private data.
  await other.client.from("favorites").insert({ user_id: other.id, pose_id: poseId });
  await other.client.from("practice_log").insert({ user_id: other.id, duration_min: 10, note: "private" });
});

afterAll(async () => {
  await cleanupUsers();
});

describe("cross-user isolation", () => {
  it("a member cannot read another member's favorites, practice log, goals, progress or profile", async () => {
    for (const table of ["favorites", "practice_log", "goals", "pose_progress", "step_completions"] as const) {
      const { data } = await member.client.from(table).select("*").eq("user_id", other.id);
      expect(data ?? [], table).toEqual([]);
    }
    const { data: profile } = await member.client.from("profiles").select("*").eq("id", other.id);
    expect(profile ?? []).toEqual([]);
  });

  it("a member cannot write rows on behalf of another member", async () => {
    expect((await member.client.from("favorites").insert({ user_id: other.id, pose_id: poseId })).error).not.toBeNull();
    expect((await member.client.from("practice_log").insert({ user_id: other.id, duration_min: 5 })).error).not.toBeNull();
    expect((await member.client.from("step_completions").insert({ user_id: other.id, program_id: programId, step_key: crypto.randomUUID() })).error).not.toBeNull();
  });

  it("a member cannot change or delete another member's rows", async () => {
    await member.client.from("practice_log").update({ note: "hacked" }).eq("user_id", other.id);
    await member.client.from("favorites").delete().eq("user_id", other.id);
    const { data: log } = await admin.from("practice_log").select("note").eq("user_id", other.id);
    const { data: fav } = await admin.from("favorites").select("pose_id").eq("user_id", other.id);
    expect(log!.map((r) => r.note)).toEqual(["private"]);
    expect(fav!.length).toBe(1);
  });
});

describe("content and admin boundaries", () => {
  it("anon and members cannot write publications, documents, roles or settings", async () => {
    for (const db of [anon(), member.client]) {
      expect((await db.from("publications").update({ slug: "x" }).eq("document_id", poseId).select()).data ?? []).toEqual([]);
      expect((await db.from("documents").insert({ type: "page", slug: "evil", draft: {} })).error).not.toBeNull();
      expect((await db.from("site_settings").update({ allow_unreviewed_publish: true }).eq("id", 1).select()).data ?? []).toEqual([]);
    }
    expect((await member.client.from("user_roles").insert({ user_id: member.id, role: "owner" })).error).not.toBeNull();
  });

  it("members cannot call the workflow functions", async () => {
    expect((await member.client.rpc("publish_document", { p_document_id: poseId })).error).not.toBeNull();
    expect((await member.client.rpc("unpublish_document", { p_document_id: poseId })).error).not.toBeNull();
    expect((await member.client.rpc("restore_version", { p_document_id: poseId, p_version_no: 1 })).error).not.toBeNull();
    expect((await member.client.rpc("set_review_status", { p_document_id: poseId, p_status: "approved", p_note: undefined })).error).not.toBeNull();
    expect((await member.client.rpc("step_completion_counts", { p_program_id: programId })).error).not.toBeNull();
  });

  it("anon cannot read roles, audit, media metadata of drafts or other private tables", async () => {
    const db = anon();
    for (const table of ["user_roles", "audit_log", "documents", "document_versions", "reviews", "profiles"] as const) {
      const { data } = await db.from(table).select("*").limit(1);
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("only editors can upload to the media bucket", async () => {
    const path = `uploads/security-test/${crypto.randomUUID()}.png`;
    expect((await anon().storage.from("media").upload(path, png, { contentType: "image/png" })).error).not.toBeNull();
    expect((await member.client.storage.from("media").upload(path, png, { contentType: "image/png" })).error).not.toBeNull();
    const ok = await editor.client.storage.from("media").upload(path, png, { contentType: "image/png" });
    expect(ok.error).toBeNull();
    // the bucket refuses types outside the allow-list even for editors
    const html = await editor.client.storage.from("media").upload(path.replace(".png", ".html"), new TextEncoder().encode("<script>alert(1)</script>"), { contentType: "text/html" });
    expect(html.error).not.toBeNull();
    await admin.storage.from("media").remove([path]);
  });
});

describe("account deletion", () => {
  it("deleting a user removes their personal rows (cascade)", async () => {
    const tmp = await userWithRoles("sec-delete");
    await tmp.client.from("favorites").insert({ user_id: tmp.id, pose_id: poseId });
    await tmp.client.from("goals").insert({ user_id: tmp.id, title: "goal" });
    expect((await admin.auth.admin.deleteUser(tmp.id)).error).toBeNull();
    expect((await admin.from("favorites").select("*").eq("user_id", tmp.id)).data ?? []).toEqual([]);
    expect((await admin.from("goals").select("*").eq("user_id", tmp.id)).data ?? []).toEqual([]);
    expect((await admin.from("profiles").select("*").eq("id", tmp.id)).data ?? []).toEqual([]);
  });
});
