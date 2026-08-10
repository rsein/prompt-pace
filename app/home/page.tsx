import { createClient } from "@/lib/supabase/server";
import HomeClient from "@/components/HomeClient";
import { getPersonalRuns, computeStats } from "@/lib/personalStats";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  const { data: memberships } = await supabase
    .from("journey_members")
    .select("journey_id, journeys(*)")
    .eq("user_id", user!.id)
    .eq("status", "accepted");

  const journeys = (memberships ?? []).map((m: any) => m.journeys).filter(Boolean);

  const journeysWithStats = await Promise.all(
    journeys.map(async (j: any) => {
      const { data: runs } = await supabase.from("runs").select("km, created_at").eq("journey_id", j.id);
      const now = new Date();
      const monthlyKm = (runs ?? [])
        .filter((r: any) => {
          const d = new Date(r.created_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        })
        .reduce((s: number, r: any) => s + Number(r.km), 0);
      const annualKm = (runs ?? [])
        .filter((r: any) => new Date(r.created_at).getFullYear() === now.getFullYear())
        .reduce((s: number, r: any) => s + Number(r.km), 0);
      const lastActivity = (runs ?? []).reduce(
        (latest: string, r: any) => (r.created_at > latest ? r.created_at : latest),
        j.created_at
      );
      return { ...j, monthlyKm, annualKm, lastActivity };
    })
  );

  // Estatísticas pessoais: usa o arquivo completo do Strava (nunca duplicado, mesmo que a corrida
  // esteja espelhada em várias jornadas) + as corridas manuais/por foto, sem contar duas vezes uma
  // mesma corrida manual que porventura tenha sido registrada em mais de uma jornada.
  const runsList = await getPersonalRuns(supabase, user!.id);
  const stats = computeStats(runsList);
  const myStats = {
    monthlyKm: stats.monthlyKm,
    annualKm: stats.annualKm,
    bestPaceSec: stats.bestPaceSec,
    avgPaceSec: stats.avgPaceSec,
    hoursSinceLastRun: stats.hoursSinceLastRun,
  };

  return <HomeClient userId={user!.id} profile={profile} journeys={journeysWithStats} myStats={myStats} />;
}
