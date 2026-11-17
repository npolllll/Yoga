import "server-only";
import { createSessionClient } from "@/lib/supabase/server";

export type StaffRole = "reviewer" | "editor" | "owner";

export interface SessionUser {
  id: string;
  email: string | null;
  roles: StaffRole[];
}

/** Reads the verified user from the session cookie (JWT claims verified by Supabase). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.claims.sub);
  return {
    id: data.claims.sub,
    email: (data.claims.email as string | undefined) ?? null,
    roles: (roles ?? []).map((r) => r.role as StaffRole),
  };
}

export const canEdit = (u: SessionUser | null) => !!u && (u.roles.includes("editor") || u.roles.includes("owner"));
export const canReview = (u: SessionUser | null) => !!u && u.roles.includes("reviewer");
export const isOwner = (u: SessionUser | null) => !!u && u.roles.includes("owner");
export const isStaff = (u: SessionUser | null) => !!u && u.roles.length > 0;
