import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

export interface MemberStatePayload {
  user: null | {
    id: string;
    email: string | null;
    displayName: string | null;
    locale: "ru" | "en";
    roles: string[];
  };
  favorites: string[];
  progress: Record<string, { status: "not_started" | "in_progress" | "learned"; updatedAt: string }>;
  completions: Record<string, string[]>; // programId -> stepKeys
}

const EMPTY: MemberStatePayload = { user: null, favorites: [], progress: {}, completions: {} };

/** Personal state of the signed-in member. Never cached. RLS limits every query to the caller's rows. */
export async function GET() {
  const supabase = await createSessionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json(EMPTY, { headers: { "Cache-Control": "private, no-store" } });

  const [profile, roles, favorites, progress, completions] = await Promise.all([
    supabase.from("profiles").select("display_name, locale").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("favorites").select("pose_id"),
    supabase.from("pose_progress").select("pose_id, status, updated_at"),
    supabase.from("step_completions").select("program_id, step_key"),
  ]);

  const payload: MemberStatePayload = {
    user: {
      id: userId,
      email: (claims.claims.email as string | undefined) ?? null,
      displayName: profile.data?.display_name ?? null,
      locale: (profile.data?.locale as "ru" | "en" | undefined) ?? "ru",
      roles: (roles.data ?? []).map((r) => r.role),
    },
    favorites: (favorites.data ?? []).map((f) => f.pose_id),
    progress: Object.fromEntries(
      (progress.data ?? []).map((p) => [p.pose_id, { status: p.status, updatedAt: p.updated_at }]),
    ),
    completions: (completions.data ?? []).reduce<Record<string, string[]>>((acc, c) => {
      (acc[c.program_id] ??= []).push(c.step_key);
      return acc;
    }, {}),
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
