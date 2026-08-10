import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncStravaActivities } from "@/lib/stravaSync";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();

  const { data: conn } = await admin
    .from("wearable_connections")
    .select("last_synced_at")
    .eq("user_id", user.id)
    .eq("provider", "strava")
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: "Você ainda não conectou o Strava." }, { status: 400 });
  }

  // Sincroniza com TODAS as jornadas que você já aceitou participar — se alguma corrida não fizer
  // sentido numa jornada específica, dá pra excluir ela por lá depois (toca na corrida → Excluir).
  const { data: memberships } = await admin
    .from("journey_members")
    .select("journey_id")
    .eq("user_id", user.id)
    .eq("status", "accepted");

  const journeyIds = (memberships ?? []).map((m: { journey_id: string }) => m.journey_id);

  const after = conn.last_synced_at
    ? Math.floor(new Date(conn.last_synced_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000) - 90 * 86400;

  try {
    const { imported, skippedDuplicates } = await syncStravaActivities(admin, user.id, after, journeyIds);

    await admin
      .from("wearable_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("provider", "strava");

    return NextResponse.json({ imported, skippedDuplicates });
  } catch (e: any) {
    if (e?.message === "not_connected") {
      return NextResponse.json({ error: "Você ainda não conectou o Strava." }, { status: 400 });
    }
    if (e?.message === "db_write_failed") {
      return NextResponse.json({ error: "O Strava respondeu, mas não consegui salvar no banco. Tenta de novo — se persistir, me avisa." }, { status: 500 });
    }
    console.error("Erro ao sincronizar Strava:", e);
    return NextResponse.json({ error: "Não consegui sincronizar agora. Tenta de novo." }, { status: 500 });
  }
}
