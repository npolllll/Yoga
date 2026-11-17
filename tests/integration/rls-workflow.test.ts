import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanupUsers, programDraft, setAllowUnreviewed, userWithRoles, uuid, type DB } from "./helpers";

/**
 * Real database tests (local Supabase): RLS, role checks in SQL functions, review workflow,
 * publication/versioning and the step-key progress invariant.
 */
let editor: { id: string; client: DB };
let reviewer: { id: string; client: DB };
let memberA: { id: string; client: DB };
let memberB: { id: string; client: DB };
let anyPoseId: string;
const createdDocs: string[] = [];

beforeAll(async () => {
  editor = await userWithRoles("editor", ["editor"]);
  reviewer = await userWithRoles("reviewer", ["reviewer"]);
  memberA = await userWithRoles("member-a");
  memberB = await userWithRoles("member-b");
  const { data } = await anon().from("publications").select("document_id").eq("type", "pose").limit(1).single();
  anyPoseId = data!.document_id;
});

afterAll(async () => {
  for (const id of createdDocs) await admin.from("documents").delete().eq("id", id);
  await setAllowUnreviewed(true);
  await cleanupUsers();
});

async function newProgram(keys: string[]) {
  const slug = `test-program-${uuid().slice(0, 8)}`;
  const { data, error } = await editor.client.from("documents").insert({ type: "program", slug, level_key: "beginner", draft: programDraft(keys) }).select("id, revision").single();
  if (error) throw error;
  createdDocs.push(data.id);
  return data;
}

describe("public read access", () => {
  it("anon reads publications and taxonomies but not drafts, versions, reviews or audit", async () => {
    const db = anon();
    expect((await db.from("publications").select("document_id").limit(1)).data?.length).toBe(1);
    expect((await db.from("levels").select("key")).data?.length).toBe(4);
    expect((await db.from("documents").select("id")).data ?? []).toHaveLength(0);
    expect((await db.from("document_versions").select("id")).data ?? []).toHaveLength(0);
    expect((await db.from("reviews").select("id")).data ?? []).toHaveLength(0);
    expect((await db.from("audit_log").select("id")).data ?? []).toHaveLength(0);
  });
  it("members cannot read drafts either", async () => {
    expect((await memberA.client.from("documents").select("id")).data ?? []).toHaveLength(0);
  });
});

describe("member data isolation", () => {
  it("a member manages only their own favorites and progress", async () => {
    expect((await memberA.client.from("favorites").insert({ user_id: memberA.id, pose_id: anyPoseId })).error).toBeNull();
    expect((await memberA.client.from("pose_progress").insert({ user_id: memberA.id, pose_id: anyPoseId, status: "in_progress" })).error).toBeNull();
    // B cannot see A's rows
    expect((await memberB.client.from("favorites").select("*")).data ?? []).toHaveLength(0);
    expect((await memberB.client.from("pose_progress").select("*")).data ?? []).toHaveLength(0);
    // B cannot write rows on behalf of A
    expect((await memberB.client.from("favorites").insert({ user_id: memberA.id, pose_id: anyPoseId })).error).not.toBeNull();
    // B cannot delete A's rows (no error, but nothing deleted)
    await memberB.client.from("favorites").delete().eq("user_id", memberA.id);
    expect((await memberA.client.from("favorites").select("*")).data).toHaveLength(1);
  });
  it("references must point to published documents of the right type", async () => {
    const { data: program } = await anon().from("publications").select("document_id").eq("type", "program").limit(1).single();
    expect((await memberA.client.from("favorites").insert({ user_id: memberA.id, pose_id: program!.document_id })).error).not.toBeNull();
    expect((await memberA.client.from("favorites").insert({ user_id: memberA.id, pose_id: uuid() })).error).not.toBeNull();
  });
  it("profiles are private and roles cannot be self-granted", async () => {
    expect((await memberB.client.from("profiles").select("*").eq("id", memberA.id)).data ?? []).toHaveLength(0);
    expect((await memberA.client.from("user_roles").insert({ user_id: memberA.id, role: "owner" })).error).not.toBeNull();
    expect((await memberA.client.rpc("publish_document", { p_document_id: anyPoseId })).error).not.toBeNull();
  });
  it("practice log and goals are private", async () => {
    expect((await memberA.client.from("practice_log").insert({ user_id: memberA.id, note: "private" })).error).toBeNull();
    expect((await memberA.client.from("goals").insert({ user_id: memberA.id, title: "Crow" })).error).toBeNull();
    expect((await memberB.client.from("practice_log").select("*")).data ?? []).toHaveLength(0);
    expect((await memberB.client.from("goals").select("*")).data ?? []).toHaveLength(0);
  });
});

describe("review workflow and publishing", () => {
  it("members cannot create documents; editors can", async () => {
    expect((await memberA.client.from("documents").insert({ type: "page", slug: `x-${uuid().slice(0, 6)}`, draft: {} })).error).not.toBeNull();
    const p = await newProgram([uuid()]);
    expect(p.id).toBeTruthy();
  });

  it("only a reviewer can approve, and only from expert_review; direct status updates are blocked", async () => {
    const p = await newProgram([uuid()]);
    // direct UPDATE of review_status is rejected
    expect((await editor.client.from("documents").update({ review_status: "approved" }).eq("id", p.id)).error).not.toBeNull();
    // editor moves it through the editorial steps
    expect((await editor.client.rpc("set_review_status", { p_document_id: p.id, p_status: "editorial_review" })).error).toBeNull();
    expect((await editor.client.rpc("set_review_status", { p_document_id: p.id, p_status: "expert_review" })).error).toBeNull();
    // editor cannot approve
    expect((await editor.client.rpc("set_review_status", { p_document_id: p.id, p_status: "approved" })).error).not.toBeNull();
    // reviewer approves
    expect((await reviewer.client.rpc("set_review_status", { p_document_id: p.id, p_status: "approved", p_comment: "ok" })).error).toBeNull();
    const { data } = await editor.client.from("documents").select("review_status").eq("id", p.id).single();
    expect(data!.review_status).toBe("approved");
    // a reviewer approval is recorded with the real reviewer account
    const { data: reviews } = await editor.client.from("reviews").select("reviewer_id, decision, kind").eq("document_id", p.id).eq("decision", "approved").eq("kind", "expert");
    expect(reviews![0].reviewer_id).toBe(reviewer.id);
  });

  it("editing approved content resets the approval", async () => {
    const p = await newProgram([uuid()]);
    await editor.client.rpc("set_review_status", { p_document_id: p.id, p_status: "editorial_review" });
    await editor.client.rpc("set_review_status", { p_document_id: p.id, p_status: "expert_review" });
    await reviewer.client.rpc("set_review_status", { p_document_id: p.id, p_status: "approved" });
    await editor.client.from("documents").update({ draft: programDraft([uuid()], "Changed") }).eq("id", p.id);
    const { data } = await editor.client.from("documents").select("review_status").eq("id", p.id).single();
    expect(data!.review_status).toBe("draft");
  });

  it("publishing requires expert approval unless the owner allows unreviewed publishing", async () => {
    await setAllowUnreviewed(false);
    const p = await newProgram([uuid()]);
    const blocked = await editor.client.rpc("publish_document", { p_document_id: p.id });
    expect(blocked.error?.message).toMatch(/approval/);
    await setAllowUnreviewed(true);
    const ok = await editor.client.rpc("publish_document", { p_document_id: p.id });
    expect(ok.error).toBeNull();
    const { data: pub } = await anon().from("publications").select("expert_approved, version_no").eq("document_id", p.id).single();
    expect(pub!.expert_approved).toBe(false); // honest flag: not reviewed by a teacher
    // unpublish removes it from public reads
    expect((await editor.client.rpc("unpublish_document", { p_document_id: p.id })).error).toBeNull();
    expect((await anon().from("publications").select("document_id").eq("document_id", p.id)).data ?? []).toHaveLength(0);
  });

  it("reviewers cannot edit or publish content", async () => {
    const p = await newProgram([uuid()]);
    await reviewer.client.from("documents").update({ draft: programDraft([uuid()], "Hacked") }).eq("id", p.id);
    const { data } = await editor.client.from("documents").select("draft").eq("id", p.id).single();
    expect((data!.draft as { title: { ru: string } }).title.ru).toBe("Test program");
    expect((await reviewer.client.rpc("publish_document", { p_document_id: p.id })).error).not.toBeNull();
  });
});

describe("step keys and member progress", () => {
  it("progress survives reordering, ignores removed steps and returns after restoring a version", async () => {
    await setAllowUnreviewed(true);
    const [k1, k2, k3] = [uuid(), uuid(), uuid()];
    const p = await newProgram([k1, k2, k3]);
    await editor.client.rpc("publish_document", { p_document_id: p.id });
    // member completes steps 1 and 2
    expect((await memberA.client.from("step_completions").insert({ user_id: memberA.id, program_id: p.id, step_key: k1 })).error).toBeNull();
    expect((await memberA.client.from("step_completions").insert({ user_id: memberA.id, program_id: p.id, step_key: k2 })).error).toBeNull();
    // unknown step keys are rejected
    expect((await memberA.client.from("step_completions").insert({ user_id: memberA.id, program_id: p.id, step_key: uuid() })).error).not.toBeNull();

    // editor reorders (k3, k1, k2) and publishes → completions still match the same steps
    await editor.client.from("documents").update({ draft: programDraft([k3, k1, k2]) }).eq("id", p.id);
    await editor.client.rpc("publish_document", { p_document_id: p.id });
    const { data: pub } = await anon().from("publications").select("doc, version_no").eq("document_id", p.id).single();
    const keys = (pub!.doc as { steps: { key: string }[] }).steps.map((s) => s.key);
    expect(keys).toEqual([k3, k1, k2]);
    const { data: done } = await memberA.client.from("step_completions").select("step_key").eq("program_id", p.id);
    expect(new Set(done!.map((d) => d.step_key))).toEqual(new Set([k1, k2]));

    // remove k1 → the completion row remains but no longer counts
    await editor.client.from("documents").update({ draft: programDraft([k3, k2]) }).eq("id", p.id);
    await editor.client.rpc("publish_document", { p_document_id: p.id });
    const { data: pub2 } = await anon().from("publications").select("doc").eq("document_id", p.id).single();
    const current = (pub2!.doc as { steps: { key: string }[] }).steps.map((s) => s.key);
    expect(current.filter((k) => [k1, k2].includes(k))).toEqual([k2]);
    expect((await memberA.client.from("step_completions").select("step_key").eq("program_id", p.id)).data).toHaveLength(2);

    // restore the version with k1 → its completion counts again
    await editor.client.rpc("restore_version", { p_document_id: p.id, p_version_no: pub!.version_no });
    await editor.client.rpc("publish_document", { p_document_id: p.id });
    const { data: pub3 } = await anon().from("publications").select("doc").eq("document_id", p.id).single();
    expect((pub3!.doc as { steps: { key: string }[] }).steps.map((s) => s.key)).toEqual([k3, k1, k2]);

    // aggregated counts for editors (no personal data)
    const { data: counts } = await editor.client.rpc("step_completion_counts", { p_program_id: p.id });
    expect(Object.fromEntries((counts ?? []).map((c: { step_key: string; completions: number }) => [c.step_key, Number(c.completions)]))).toMatchObject({ [k1]: 1, [k2]: 1 });
    expect((await memberA.client.rpc("step_completion_counts", { p_program_id: p.id })).error).not.toBeNull();
  });

  it("rejects duplicate step keys inside a program and keys reused by another published program", async () => {
    const k = uuid();
    const dup = await newProgram([k, k]);
    expect((await editor.client.rpc("publish_document", { p_document_id: dup.id })).error?.message).toMatch(/duplicate/);
    const a = await newProgram([k]);
    expect((await editor.client.rpc("publish_document", { p_document_id: a.id })).error).toBeNull();
    const b = await newProgram([k]);
    expect((await editor.client.rpc("publish_document", { p_document_id: b.id })).error?.message).toMatch(/another program/);
  });

  it("writes an audit trail", async () => {
    const { data } = await editor.client.from("audit_log").select("action").order("id", { ascending: false }).limit(50);
    const actions = new Set((data ?? []).map((d) => d.action));
    expect(actions.has("publish")).toBe(true);
    expect(actions.has("status")).toBe(true);
  });
});
