import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncStravaActivities } from "@/lib/stravaSync";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { years } = await request.json().catch(() => ({ years: 3 }));
  const yearsBack = Math.min(Math.max(years || 3, 1), 10);
  const after = Math.floor(Date.now() / 1000) - yearsBack * 365 * 86400;

  const admin = createAdminClient();

  try {
    // targetJourneyIds vazio: só alimenta o arquivo pessoal (strava_history), não mexe em nenhuma jornada
    const { activityCount } = await syncStravaActivities(admin, user.id, after, [], { maxPages: 15 });
    return NextResponse.json({ imported: activityCount });
  } catch (e: any) {
    if (e?.message === "not_connected") {
      return NextResponse.json({ error: "Você ainda não conectou o Strava." }, { status: 400 });
    }
    console.error("Erro ao importar histórico completo do Strava:", e);
    return NextResponse.json({ error: "Não consegui importar agora. Tenta de novo depois." }, { status: 500 });
  }
}
