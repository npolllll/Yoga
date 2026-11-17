import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/i18n/paths";

/**
 * Email links (sign-up confirmation, password recovery) land here.
 * PKCE: ?code=… is exchanged for a session; token_hash links are verified with verifyOtp.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"), "/ru/my-practice");
  const locale = next.split("/")[1] === "en" ? "en" : "ru";
  const supabase = await createSessionClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }
  if (!ok) return NextResponse.redirect(new URL(`/${locale}/login?error=link`, url.origin));
  const target = new URL(next, url.origin);
  if (url.searchParams.get("confirmed")) target.searchParams.set("welcome", "1");
  return NextResponse.redirect(target);
}
