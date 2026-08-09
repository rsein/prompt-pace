import { createClient } from "@/lib/supabase/server";
import HomeClient from "@/components/HomeClient";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  const { data: memberships } = await supabase
    .from("journey_members")
    .select("journey_id, journeys(*)")
    .eq("user_id", user!.id);

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

  const { data: myRuns } = await supabase
    .from("runs")
    .select("km, time_sec, created_at")
    .eq("user_id", user!.id);

  const now = new Date();
  const runsList = (myRuns ?? []) as { km: number; time_sec: number; created_at: string }[];

  const myMonthlyKm = runsList
    .filter((r) => {
      const d = new Date(r.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, r) => s + Number(r.km), 0);

  const myAnnualKm = runsList
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

  const myStats = { monthlyKm: myMonthlyKm, annualKm: myAnnualKm, bestPaceSec, avgPaceSec };

  return <HomeClient userId={user!.id} profile={profile} journeys={journeysWithStats} myStats={myStats} />;
}
