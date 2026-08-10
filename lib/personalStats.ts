import type { SupabaseClient } from "@supabase/supabase-js";

export type PersonalRun = { km: number; time_sec: number; created_at: string };

// Junta o arquivo do Strava (nunca duplicado) com as corridas manuais/por foto, removendo
// manuais repetidas (mesmo dia + km parecido) que porventura estejam espelhadas em mais de uma jornada.
export async function getPersonalRuns(supabase: SupabaseClient, userId: string): Promise<PersonalRun[]> {
  const [{ data: stravaHistory }, { data: manualRunsRaw }] = await Promise.all([
    supabase.from("strava_history").select("km, time_sec, created_at").eq("user_id", userId),
    supabase.from("runs").select("km, time_sec, created_at").eq("user_id", userId).neq("source", "strava"),
  ]);

  const seen = new Set<string>();
  const dedupedManual = (manualRunsRaw ?? []).filter((r: PersonalRun) => {
    const key = `${new Date(r.created_at).toDateString()}_${Number(r.km).toFixed(1)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...(stravaHistory ?? []), ...dedupedManual] as PersonalRun[];
}

export function computeStats(runsList: PersonalRun[]) {
  const now = new Date();

  const monthlyKm = runsList
    .filter((r) => {
      const d = new Date(r.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, r) => s + Number(r.km), 0);

  const annualKm = runsList
    .filter((r) => new Date(r.created_at).getFullYear() === now.getFullYear())
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
  const hoursSinceLastRun = lastRunAt ? (now.getTime() - new Date(lastRunAt).getTime()) / 3600000 : null;

  const longestKm = runsList.reduce((max, r) => Math.max(max, Number(r.km)), 0);

  return { monthlyKm, annualKm, totalKm, avgPaceSec, bestPaceSec, hoursSinceLastRun, longestKm, runsCount: runsList.length };
}
