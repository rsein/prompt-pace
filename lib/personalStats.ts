import type { SupabaseClient } from "@supabase/supabase-js";
import { brazilParts } from "./utils";

export type PersonalRun = {
  km: number;
  time_sec: number;
  created_at: string;
  source: "strava" | "manual";
  key: string; // external_id (strava) ou id da linha em runs (manual) — usado pra poder excluir
};

// Junta o arquivo do Strava (nunca duplicado) com as corridas manuais/por foto, removendo:
// 1) manuais repetidas entre si (mesma corrida espelhada em mais de uma jornada)
// 2) manuais que já existem no Strava também (ex: você digitou a corrida antes de conectar o Strava,
//    e agora ela também apareceu por lá — sem isso, contava dobrado)
export async function getPersonalRuns(supabase: SupabaseClient, userId: string): Promise<PersonalRun[]> {
  const [{ data: stravaHistory }, { data: manualRunsRaw }] = await Promise.all([
    supabase.from("strava_history").select("external_id, km, time_sec, created_at").eq("user_id", userId),
    supabase.from("runs").select("id, km, time_sec, created_at").eq("user_id", userId).neq("source", "strava"),
  ]);

  const strava: PersonalRun[] = (stravaHistory ?? []).map((r: any) => ({
    km: r.km,
    time_sec: r.time_sec,
    created_at: r.created_at,
    source: "strava" as const,
    key: r.external_id,
  }));

  function matchesExisting(
    list: { km: number; time_sec: number; created_at: string }[],
    km: number,
    timeSec: number,
    createdAt: string
  ) {
    return list.some((r) => {
      const sameDay = new Date(r.created_at).toDateString() === new Date(createdAt).toDateString();
      const kmDiff = Math.abs(Number(r.km) - km);
      const timeDiff = Math.abs(r.time_sec - timeSec);
      // exige distância E duração parecidas — só km parecido não basta (duas corridas diferentes
      // no mesmo dia podem ter distância parecida por coincidência, sem ser a mesma corrida)
      return sameDay && kmDiff < 0.15 && timeDiff < 120;
    });
  }

  const seenManual: { km: number; time_sec: number; created_at: string }[] = [];
  const dedupedManual: PersonalRun[] = [];
  for (const r of manualRunsRaw ?? []) {
    // já existe uma corrida do Strava bem parecida no mesmo dia? não conta essa manual de novo
    if (matchesExisting(strava, Number(r.km), r.time_sec, r.created_at)) continue;
    // já contei uma manual bem parecida nessa mesma passada (duplicada entre jornadas)? também não conta de novo
    if (matchesExisting(seenManual, Number(r.km), r.time_sec, r.created_at)) continue;
    seenManual.push(r);
    dedupedManual.push({ km: r.km, time_sec: r.time_sec, created_at: r.created_at, source: "manual", key: r.id });
  }

  return [...strava, ...dedupedManual];
}

export function computeStats(runsList: PersonalRun[]) {
  const now = brazilParts();

  const monthlyKm = runsList
    .filter((r) => {
      const d = brazilParts(r.created_at);
      return d.year === now.year && d.month === now.month;
    })
    .reduce((s, r) => s + Number(r.km), 0);

  const annualKm = runsList
    .filter((r) => brazilParts(r.created_at).year === now.year)
    .reduce((s, r) => s + Number(r.km), 0);

  const totalKm = runsList.reduce((s, r) => s + Number(r.km), 0);
  const totalSec = runsList.reduce((s, r) => s + r.time_sec, 0);
  const avgPaceSec = totalKm > 0 ? totalSec / totalKm : null;

  const bestPaceSec = runsList.reduce<number | null>((best, r) => {
    if (!r.km || r.km <= 0) return best;
    const pace = r.time_sec / Number(r.km);
    return best === null || pace < best ? pace : best;
  }, null);

  const lastRunAt = runsList.reduce<string | null>((latest, r) => {
    if (!latest || new Date(r.created_at) > new Date(latest)) return r.created_at;
    return latest;
  }, null);
  const hoursSinceLastRun = lastRunAt ? (Date.now() - new Date(lastRunAt).getTime()) / 3600000 : null;

  const longestKm = runsList.reduce((max, r) => Math.max(max, Number(r.km)), 0);

  return { monthlyKm, annualKm, totalKm, avgPaceSec, bestPaceSec, hoursSinceLastRun, longestKm, runsCount: runsList.length };
}
