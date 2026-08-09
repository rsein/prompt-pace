import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeStravaCode } from "@/lib/strava";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const journeyId = searchParams.get("state");
  const error = searchParams.get("error");

  if (!journeyId) return NextResponse.redirect(new URL("/home", request.url));
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  if (error || !code) {
    return NextResponse.redirect(new URL(`/journey/${journeyId}?strava=denied`, request.url));
  }

  try {
    const token = await exchangeStravaCode(code);
    const admin = createAdminClient();

    const { error: dbError } = await admin.from("wearable_connections").upsert(
      {
        user_id: user.id,
        provider: "strava",
        provider_user_id: String(token.athlete.id),
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: token.expires_at,
        scope: "activity:read_all",
        default_journey_id: journeyId,
        last_synced_at: null,
      },
      { onConflict: "user_id,provider" }
    );

    if (dbError) throw dbError;

    return NextResponse.redirect(new URL(`/journey/${journeyId}?strava=connected`, request.url));
  } catch (e) {
    console.error("Erro no callback do Strava:", e);
    return NextResponse.redirect(new URL(`/journey/${journeyId}?strava=error`, request.url));
  }
}
