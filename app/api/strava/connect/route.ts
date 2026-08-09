import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stravaAuthorizeUrl } from "@/lib/strava";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = new URL(request.url);
  const journeyId = searchParams.get("journeyId");

  if (!user || !journeyId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!process.env.STRAVA_CLIENT_ID || !process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.redirect(new URL(`/profile?strava=not_configured`, request.url));
  }

  return NextResponse.redirect(stravaAuthorizeUrl(journeyId));
}
