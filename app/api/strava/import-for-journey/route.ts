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

  const { journeyId, sinceDate } = await request.json();
  if (!journeyId || !sinceDate) {
    return NextResponse.json({ error: "Dados faltando" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Confere se a pessoa realmente é membro dessa jornada (pending ou accepted) antes de importar pra ela
  const { data: membership } = await admin
    .from("journey_members")
    .select("user_id")
    .eq("journey_id", journeyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Você não é membro dessa jornada." }, { status: 403 });
  }

  const after = Math.floor(new Date(sinceDate).getTime() / 1000);

  try {
    const { imported, skippedDuplicates } = await syncStravaActivities(admin, user.id, after, [journeyId]);
    return NextResponse.json({ imported, skippedDuplicates });
  } catch (e: any) {
    if (e?.message === "not_connected") {
      return NextResponse.json({ error: "Você ainda não conectou o Strava." }, { status: 400 });
    }
    console.error("Erro ao importar corridas do Strava pra jornada:", e);
    return NextResponse.json({ error: "Não consegui importar agora. Tenta de novo depois." }, { status: 500 });
  }
}
