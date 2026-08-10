import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshStravaToken, type StravaActivity } from "@/lib/strava";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { journeyId } = await request.json();
  if (!journeyId) return NextResponse.json({ error: "journeyId faltando" }, { status: 400 });

  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("wearable_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "strava")
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: "Você ainda não conectou o Strava." }, { status: 400 });
  }

  let accessToken = conn.access_token as string;

  // renova o token se estiver perto de expirar
  if (!conn.expires_at || conn.expires_at < Math.floor(Date.now() / 1000) + 60) {
    try {
      const refreshed = await refreshStravaToken(conn.refresh_token);
      accessToken = refreshed.access_token;
      await admin
        .from("wearable_connections")
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: refreshed.expires_at,
        })
        .eq("user_id", user.id)
        .eq("provider", "strava");
    } catch (e) {
      console.error("Erro ao renovar token do Strava:", e);
      return NextResponse.json(
        { error: "A conexão com o Strava expirou. Conecta de novo na aba Perfil." },
        { status: 401 }
      );
    }
  }

  // busca desde a última sincronização (ou os últimos 90 dias, na primeira vez)
  const after = conn.last_synced_at
    ? Math.floor(new Date(conn.last_synced_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000) - 90 * 86400;

  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      console.error("Erro ao buscar atividades do Strava:", res.status, await res.text());
      return NextResponse.json({ error: "Não consegui buscar as corridas no Strava agora." }, { status: 502 });
    }

    const activities: StravaActivity[] = await res.json();
    const runs = activities.filter((a) => a.type === "Run" || a.sport_type === "Run" || a.sport_type === "TrailRun");

    // Pega as corridas que já existem (manual ou por foto) pra não duplicar com o que o Strava também tem
    const { data: existingRuns } = await admin
      .from("runs")
      .select("km, created_at")
      .eq("journey_id", journeyId)
      .eq("user_id", user.id)
      .neq("source", "strava");

    function looksLikeDuplicate(activityKm: number, activityDate: Date) {
      return (existingRuns ?? []).some((r) => {
        const sameDay = new Date(r.created_at).toDateString() === activityDate.toDateString();
        const kmDiff = Math.abs(Number(r.km) - activityKm);
        return sameDay && kmDiff < 0.3;
      });
    }

    let imported = 0;
    let skippedDuplicates = 0;
    for (const activity of runs) {
      const activityKm = activity.distance / 1000;
      if (looksLikeDuplicate(activityKm, new Date(activity.start_date))) {
        skippedDuplicates++;
        continue;
      }

      const { error: insertError } = await admin.from("runs").insert({
        journey_id: journeyId,
        user_id: user.id,
        km: activityKm,
        time_sec: activity.moving_time,
        bpm: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
        calories: activity.calories ? Math.round(activity.calories) : null,
        created_at: activity.start_date,
        source: "strava",
        external_id: String(activity.id),
      });
      // ignora erro de duplicata (unique index runs_external_unique) — só conta o que entrou
      if (!insertError) imported++;
    }

    await admin
      .from("wearable_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("provider", "strava");

    return NextResponse.json({ imported, skippedDuplicates });
  } catch (e) {
    console.error("Erro inesperado ao sincronizar Strava:", e);
    return NextResponse.json({ error: "Não consegui sincronizar agora. Tenta de novo." }, { status: 500 });
  }
}
