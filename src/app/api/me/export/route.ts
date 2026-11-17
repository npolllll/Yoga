import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

/** GDPR-style export of the CURRENT user's data (RLS restricts every query to the caller). */
export async function GET() {
  const supabase = await createSessionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [profile, favorites, progress, completions, log, goals] = await Promise.all([
    supabase.from("profiles").select("display_name, locale, created_at, updated_at").eq("id", userId).maybeSingle(),
    supabase.from("favorites").select("pose_id, created_at"),
    supabase.from("pose_progress").select("pose_id, status, updated_at"),
    supabase.from("step_completions").select("program_id, step_key, completed_at"),
    supabase.from("practice_log").select("practiced_on, pose_id, program_id, duration_min, note, created_at"),
    supabase.from("goals").select("title, pose_id, target_date, achieved_at, created_at"),
  ]);
  const ids = [
    ...new Set([
      ...(favorites.data ?? []).map((f) => f.pose_id),
      ...(progress.data ?? []).map((p) => p.pose_id),
      ...(completions.data ?? []).map((c) => c.program_id),
    ]),
  ];
  const titles = ids.length ? await supabase.from("publications").select("document_id, slug").in("document_id", ids) : { data: [] };
  const body = {
    exportedAt: new Date().toISOString(),
    account: { id: userId, email: claims.claims.email ?? null, ...profile.data },
    favorites: favorites.data ?? [],
    poseProgress: progress.data ?? [],
    programStepCompletions: completions.data ?? [],
    practiceLog: log.data ?? [],
    goals: goals.data ?? [],
    references: titles.data ?? [],
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="balance-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
