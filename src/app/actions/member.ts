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
