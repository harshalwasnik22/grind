import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link callback. Supabase's email link points here with a `token_hash`
 * and `type`; we verify it (which sets the session cookies) and then route the
 * user to onboarding (if their profile is incomplete) or their destination.
 *
 * NOTE: the Supabase email template must link to:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
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
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
