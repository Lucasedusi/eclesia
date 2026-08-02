import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirect } from "@/modules/auth/utils/safe-redirect";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "recovery",
  "email_change",
]);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type");

  if (tokenHash && rawType && EMAIL_OTP_TYPES.has(rawType as EmailOtpType)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: rawType as EmailOtpType,
    });

    if (!error) {
      const defaultDestination =
        rawType === "recovery" ? "/redefinir-senha" : "/onboarding";
      const destination = getSafeRedirect(
        request.nextUrl.searchParams.get("next"),
        defaultDestination,
      );

      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("erro", "link-invalido");
  return NextResponse.redirect(loginUrl);
}
