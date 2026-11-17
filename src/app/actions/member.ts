"use server";

import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: "auth" | "invalid" | "failed" };

async function requireUser() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  return { supabase, userId };
}

const Uuid = z.uuid();
const Status = z.enum(["not_started", "in_progress", "learned"]);

export async function setFavorite(poseId: string, on: boolean): Promise<Result> {
  if (!Uuid.safeParse(poseId).success || typeof on !== "boolean") return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "auth" };
  const res = on
    ? await supabase.from("favorites").upsert({ user_id: userId, pose_id: poseId }, { onConflict: "user_id,pose_id", ignoreDuplicates: true })
    : await supabase.from("favorites").delete().eq("user_id", userId).eq("pose_id", poseId);
  return res.error ? { ok: false, error: "failed" } : { ok: true };
}

export async function setPoseStatus(poseId: string, status: string): Promise<Result> {
  const parsed = Status.safeParse(status);
  if (!Uuid.safeParse(poseId).success || !parsed.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "auth" };
  const res =
    parsed.data === "not_started"
      ? await supabase.from("pose_progress").delete().eq("user_id", userId).eq("pose_id", poseId)
      : await supabase
          .from("pose_progress")
          .upsert({ user_id: userId, pose_id: poseId, status: parsed.data }, { onConflict: "user_id,pose_id" });
  return res.error ? { ok: false, error: "failed" } : { ok: true };
}

export async function setStepCompletion(programId: string, stepKey: string, done: boolean): Promise<Result> {
  if (!Uuid.safeParse(programId).success || !Uuid.safeParse(stepKey).success || typeof done !== "boolean")
    return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "auth" };
  const res = done
    ? await supabase
        .from("step_completions")
        .upsert(
          { user_id: userId, program_id: programId, step_key: stepKey },
          { onConflict: "user_id,program_id,step_key", ignoreDuplicates: true },
        )
    : await supabase.from("step_completions").delete().eq("user_id", userId).eq("program_id", programId).eq("step_key", stepKey);
  return res.error ? { ok: false, error: "failed" } : { ok: true };
}

const LogEntry = z.object({
  practicedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  poseId: z.uuid().nullable(),
  durationMin: z.number().int().min(1).max(600).nullable(),
  note: z.string().max(1000).nullable(),
});

export async function addPracticeEntry(input: z.infer<typeof LogEntry>): Promise<Result & { id?: string }> {
  const parsed = LogEntry.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "auth" };
  const { data, error } = await supabase
    .from("practice_log")
    .insert({
      user_id: userId,
      practiced_on: parsed.data.practicedOn,
      pose_id: parsed.data.poseId,
      duration_min: parsed.data.durationMin,
      note: parsed.data.note?.trim() || null,
    })
    .select("id")
    .single();
  return error ? { ok: false, error: "failed" } : { ok: true, id: data.id };
}

export async function deletePracticeEntry(id: string): Promise<Result> {
  if (!Uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("practice_log").delete().eq("id", id).eq("user_id", userId);
  return error ? { ok: false, error: "failed" } : { ok: true };
}

const Goal = z.object({
  title: z.string().trim().min(1).max(200),
  poseId: z.uuid().nullable(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function addGoal(input: z.infer<typeof Goal>): Promise<Result & { id?: string }> {
  const parsed = Goal.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "auth" };
  const { data, error } = await supabase
    .from("goals")
    .insert({ user_id: userId, title: parsed.data.title, pose_id: parsed.data.poseId, target_date: parsed.data.targetDate })
    .select("id")
    .single();
  return error ? { ok: false, error: "failed" } : { ok: true, id: data.id };
}

export async function setGoalAchieved(id: string, achieved: boolean): Promise<Result> {
  if (!Uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase
    .from("goals")
    .update({ achieved_at: achieved ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", userId);
  return error ? { ok: false, error: "failed" } : { ok: true };
}

export async function deleteGoal(id: string): Promise<Result> {
  if (!Uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", userId);
  return error ? { ok: false, error: "failed" } : { ok: true };
}

export interface PracticeEntry {
  id: string;
  practicedOn: string;
  poseId: string | null;
  durationMin: number | null;
  note: string | null;
}
export interface GoalItem {
  id: string;
  title: string;
  poseId: string | null;
  targetDate: string | null;
  achievedAt: string | null;
}

export async function listPractice(): Promise<{ log: PracticeEntry[]; goals: GoalItem[] } | null> {
  const { supabase, userId } = await requireUser();
  if (!userId) return null;
  const [log, goals] = await Promise.all([
    supabase.from("practice_log").select("id, practiced_on, pose_id, duration_min, note").order("practiced_on", { ascending: false }).limit(200),
    supabase.from("goals").select("id, title, pose_id, target_date, achieved_at").order("created_at", { ascending: false }).limit(100),
  ]);
  return {
    log: (log.data ?? []).map((r) => ({ id: r.id, practicedOn: r.practiced_on, poseId: r.pose_id, durationMin: r.duration_min, note: r.note })),
    goals: (goals.data ?? []).map((g) => ({ id: g.id, title: g.title, poseId: g.pose_id, targetDate: g.target_date, achievedAt: g.achieved_at })),
  };
}

const Profile = z.object({ displayName: z.string().trim().max(80), locale: z.enum(["ru", "en"]) });

export async function updateProfile(input: z.infer<typeof Profile>): Promise<Result> {
  const parsed = Profile.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName || null, locale: parsed.data.locale })
    .eq("id", userId);
  return error ? { ok: false, error: "failed" } : { ok: true };
}

/** Deletes the CURRENT user's account. All member rows cascade (favorites, progress, log, goals). */
export async function deleteAccount(confirmation: string, expected: string): Promise<Result> {
  if (confirmation.trim() !== expected || !["УДАЛИТЬ", "DELETE"].includes(expected)) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "auth" };
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: "failed" };
  await supabase.auth.signOut();
  return { ok: true };
}
