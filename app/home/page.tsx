import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("journey_members")
    .select("journey_id, journeys(*)")
    .eq("user_id", user!.id);

  const journeys = (memberships ?? []).map((m: any) => m.journeys).filter(Boolean);

  const journeysWithProgress = await Promise.all(
    journeys.map(async (j: any) => {
      const { data: runs } = await supabase.from("runs").select("km").eq("journey_id", j.id);
      const totalKm = (runs ?? []).reduce((s: number, r: any) => s + Number(r.km), 0);
      return { ...j, totalKm };
    })
  );

  return (
    <div className="px-6 py-8 max-w-md mx-auto">
      <div className="text-xs uppercase tracking-widest text-muted font-bold">Bem-vindo de volta</div>
      <div className="font-display text-4xl mt-1 mb-6">Suas jornadas</div>

      {journeysWithProgress.length === 0 && (
        <div className="text-sm text-muted bg-surface rounded-2xl p-5">
          Você ainda não está em nenhuma jornada. Peça pra quem criou o grupo te adicionar, ou crie a sua no Supabase por enquanto — a tela de criação de jornada vem no próximo passo.
        </div>
      )}

      {journeysWithProgress.map((j: any) => {
        const pct = Math.min(100, Math.round((j.totalKm / j.goal_km) * 100));
        return (
          <Link
            key={j.id}
            href={`/journey/${j.id}`}
            className="block rounded-2xl p-5 mb-3 border"
            style={{
              background: `linear-gradient(135deg, ${j.theme_a}22, ${j.theme_b}33), #0F1329`,
              borderColor: `${j.theme_a}44`,
            }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: j.theme_a }}>
              {j.season}
            </div>
            <div className="font-display text-2xl mt-0.5">{j.title}</div>

            <div className="mt-4">
              <div className="flex justify-between text-sm font-bold mb-1.5">
                <span>{j.totalKm.toFixed(1)} km</span>
                <span className="text-muted">meta {j.goal_km} km</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${j.theme_a}, ${j.theme_b})` }}
                />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
