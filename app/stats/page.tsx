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

  // Agrupa por mês (últimos 12 meses), pro gráfico e pra lista
  const now = new Date();
  const months: { key: string; label: string; km: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    const km = runsList
      .filter((r) => {
        const rd = new Date(r.created_at);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
      })
      .reduce((s, r) => s + Number(r.km), 0);
    months.push({ key, label, km: Math.round(km * 10) / 10 });
  }

  const sortedRuns = [...runsList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return <StatsClient stats={stats} months={months} runs={sortedRuns} />;
}
