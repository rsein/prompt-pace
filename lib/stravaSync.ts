import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshStravaToken, fetchStravaActivities, isRunActivity, type StravaActivity } from "./strava";

export async function getValidStravaAccessToken(admin: SupabaseClient, userId: string): Promise<string> {
  const { data: conn } = await admin
    .from("wearable_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "strava")
    .maybeSingle();

  if (!conn) throw new Error("not_connected");

  if (!conn.expires_at || conn.expires_at < Math.floor(Date.now() / 1000) + 60) {
    const refreshed = await refreshStravaToken(conn.refresh_token);
    await admin
      .from("wearable_connections")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: refreshed.expires_at,
      })
      .eq("user_id", userId)
      .eq("provider", "strava");
    return refreshed.access_token;
  }

  return conn.access_token as string;
}

// Confere se uma atividade do Strava já bate com algo cadastrado manual/por foto no mesmo dia,
// com distância e duração bem parecidas — pra não duplicar quando a pessoa já tinha anotado na mão.
function looksLikeManualDuplicate(
  existingRuns: { km: number; time_sec: number; created_at: string }[],
  activityKm: number,
  activityTimeSec: number,
  activityDate: Date
) {
  return existingRuns.some((r) => {
    const sameDay = new Date(r.created_at).toDateString() === activityDate.toDateString();
    const kmDiff = Math.abs(Number(r.km) - activityKm);
    const timeDiff = Math.abs(r.time_sec - activityTimeSec);
    return sameDay && kmDiff < 0.15 && timeDiff < 120;
  });
}

export async function syncStravaActivities(
  admin: SupabaseClient,
  userId: string,
  afterUnixSeconds: number,
  targetJourneyIds: string[],
  opts: { maxPages?: number } = {}
): Promise<{ imported: number; skippedDuplicates: number; activityCount: number }> {
  const accessToken = await getValidStravaAccessToken(admin, userId);
  const activities = await fetchStravaActivities(accessToken, afterUnixSeconds, opts.maxPages ?? 10);
  const runs: StravaActivity[] = activities.filter(isRunActivity);

  // Arquivo pessoal (todas as jornadas, sem duplicar por journey_id) — sempre atualizado
  const historyRows = runs.map((a) => ({
    user_id: userId,
    external_id: String(a.id),
    km: a.distance / 1000,
    time_sec: a.moving_time,
    bpm: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    calories: a.calories ? Math.round(a.calories) : null,
    created_at: a.start_date,
  }));
  if (historyRows.length > 0) {
    await admin.from("strava_history").upsert(historyRows, { onConflict: "user_id,external_id", ignoreDuplicates: true });
  }

  let imported = 0;
  let skippedDuplicates = 0;

  for (const journeyId of targetJourneyIds) {
    const { data: existingRuns } = await admin
      .from("runs")
      .select("km, time_sec, created_at")
      .eq("journey_id", journeyId)
      .eq("user_id", userId)
      .neq("source", "strava");

    const rowsToUpsert = [];
    for (const activity of runs) {
      const activityKm = activity.distance / 1000;
      if (looksLikeManualDuplicate(existingRuns ?? [], activityKm, activity.moving_time, new Date(activity.start_date))) {
        skippedDuplicates++;
        continue;
      }
      rowsToUpsert.push({
        journey_id: journeyId,
        user_id: userId,
        km: activityKm,
        time_sec: activity.moving_time,
        bpm: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
        calories: activity.calories ? Math.round(activity.calories) : null,
        created_at: activity.start_date,
        source: "strava",
        external_id: String(activity.id),
      });
    }

    if (rowsToUpsert.length > 0) {
      // upsert (não insert simples) garante que reconectar o Strava nunca duplica corrida já importada
      const { error } = await admin
        .from("runs")
        .upsert(rowsToUpsert, { onConflict: "journey_id,source,external_id", ignoreDuplicates: true });
      if (!error) imported += rowsToUpsert.length;
    }
  }

  return { imported, skippedDuplicates, activityCount: runs.length };
}
