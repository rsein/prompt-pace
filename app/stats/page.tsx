import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPersonalRuns, computeStats } from "@/lib/personalStats";
import StatsClient from "@/components/StatsClient";

export default async function StatsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const runsList = await getPersonalRuns(supabase, user.id);
  const stats = computeStats(runsList);

  const { data: memberships } = await supabase
    .from("journey_members")
    .select("journeys(id, title, theme_a, theme_b)")
    .eq("user_id", user.id)
    .eq("status", "accepted");
  const journeys = (memberships ?? [])
    .map((m: any) => m.journeys)
    .filter(Boolean) as { id: string; title: string; theme_a: string; theme_b: string }[];

  // Agrupa por mês, de janeiro a dezembro, pros últimos 3 anos (ano atual por último — é onde o carrossel abre)
  const now = new Date();
  const yearsData: { year: number; months: { key: string; label: string; km: number }[] }[] = [];
  for (let yOffset = 2; yOffset >= 0; yOffset--) {
    const year = now.getFullYear() - yOffset;
    const months: { key: string; label: string; km: number }[] = [];
    for (let month = 0; month < 12; month++) {
      const d = new Date(year, month, 1);
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      const km = runsList
        .filter((r) => {
          const rd = new Date(r.created_at);
          return rd.getFullYear() === year && rd.getMonth() === month;
        })
        .reduce((s, r) => s + Number(r.km), 0);
      months.push({ key, label, km: Math.round(km * 10) / 10 });
    }
    yearsData.push({ year, months });
  }

  const sortedRuns = [...runsList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return <StatsClient stats={stats} yearsData={yearsData} runs={sortedRuns} journeys={journeys} userId={user.id} />;
}
