import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link callback. Handles both Supabase sign-in styles so it works with
 * the stock email template *or* a customised one:
 *
 *  - **PKCE** (default template `{{ .ConfirmationURL }}`): the link returns here
 *    with a `?code=`, which we exchange for a session. Requires the sign-in and
 *    the click to happen in the same browser (the code-verifier cookie lives here).
 *  - **token_hash** (custom template): the link carries `token_hash` + `type`,
 *    which we verify directly. This flow is stateless / cross-device. To use it,
 *    point the Magic Link email template at:
 *      {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/
 *
 * Either way, verifying sets the session cookies; we then route the user to
 * onboarding (if their profile is incomplete) or their destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  let verified = false;
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    verified = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  }

  if (verified) {
    let dest = next;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      // New / incomplete players go through onboarding first.
      if (!profile?.display_name) dest = "/onboarding";
    }

    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
