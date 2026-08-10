"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { fmtPace, fmtTime, fmtDate } from "@/lib/utils";
import StravaTag from "./StravaTag";

type Stats = {
  monthlyKm: number;
  annualKm: number;
  totalKm: number;
  avgPaceSec: number | null;
  bestPaceSec: number | null;
  longestKm: number;
  runsCount: number;
};

type MonthData = { key: string; label: string; km: number };
type PersonalRun = { km: number; time_sec: number; created_at: string; source: "strava" | "manual"; key: string };

const THEME_A = "#29F1D6";
const THEME_B = "#8B5CF6";

function monthGroupLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function StatsClient({ stats, months, runs }: { stats: Stats; months: MonthData[]; runs: PersonalRun[] }) {
  const supabase = createClient();
  const [items, setItems] = useState(runs);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  async function handleDelete(run: PersonalRun) {
    setDeletingKey(run.key);
    try {
      if (run.source === "strava") {
        await supabase.from("strava_history").delete().eq("external_id", run.key);
      } else {
        await supabase.from("runs").delete().eq("id", run.key);
      }
      setItems((prev) => prev.filter((r) => r.key !== run.key));
    } finally {
      setDeletingKey(null);
      setConfirmKey(null);
    }
  }

  const groups: { label: string; runs: PersonalRun[] }[] = [];
  for (const run of items) {
    const label = monthGroupLabel(run.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.runs.push(run);
    else groups.push({ label, runs: [run] });
  }

  return (
    <div className="max-w-md mx-auto pb-16 px-5 pt-6">
      <Link href="/home" className="flex items-center gap-1 text-sm font-bold text-muted mb-6 w-fit">
        <ChevronLeft size={16} /> Home
      </Link>

      <div className="font-display text-3xl mb-5">Suas estatísticas</div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 mb-6 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
        <StatCard label="Total" value={`${stats.totalKm.toFixed(1)} km`} />
        <StatCard label="Este mês" value={`${stats.monthlyKm.toFixed(1)} km`} />
        <StatCard label="Este ano" value={`${stats.annualKm.toFixed(1)} km`} />
        <StatCard label="Melhor pace" value={stats.bestPaceSec ? `${fmtPace(stats.bestPaceSec, 1)} /km` : "—"} />
        <StatCard label="Pace médio" value={stats.avgPaceSec ? `${fmtPace(stats.avgPaceSec, 1)} /km` : "—"} />
        <StatCard label="Corridas" value={String(stats.runsCount)} />
        <StatCard label="Maior corrida" value={`${stats.longestKm.toFixed(1)} km`} />
      </div>

      {months.some((m) => m.km > 0) && (
        <>
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5">Km por mês</div>
          <div className="bg-surface rounded-2xl p-4 mb-6" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={THEME_A} />
                    <stop offset="100%" stopColor={THEME_B} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8890B5", fontSize: 11 }}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  contentStyle={{ background: "#0F1329", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`${value} km`, ""]}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="km" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5">
        Histórico completo <span className="normal-case font-semibold text-[10px]">(toque no ícone pra excluir)</span>
      </div>

      {groups.length === 0 && (
        <div className="text-sm text-muted bg-surface rounded-2xl p-4">Nenhuma corrida registrada ainda.</div>
      )}

      {groups.map((group) => (
        <div key={group.label} className="mb-4">
          <div className="text-[11px] text-muted font-bold mb-1.5 capitalize px-1">{group.label}</div>
          <div className="bg-surface rounded-2xl p-1.5">
            {group.runs.map((r, i) => (
              <div
                key={r.key}
                className="flex items-center gap-2 px-2.5 py-2.5"
                style={{ borderBottom: i < group.runs.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center gap-1.5">
                    {fmtPace(r.time_sec, Number(r.km))} /km · {fmtTime(r.time_sec)} min
                    {r.source === "strava" && <StravaTag />}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold">{Number(r.km).toFixed(1)} km</div>
                  <div className="text-[10px] text-muted font-semibold">{fmtDate(r.created_at)}</div>
                </div>

                {confirmKey === r.key ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDelete(r)}
                      disabled={deletingKey === r.key}
                      className="text-[10px] font-bold px-2 py-1.5 rounded-lg bg-red-500 text-white"
                    >
                      {deletingKey === r.key ? "..." : "Excluir"}
                    </button>
                    <button
                      onClick={() => setConfirmKey(null)}
                      className="text-[10px] font-bold px-2 py-1.5 rounded-lg text-muted"
                      style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmKey(r.key)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted shrink-0"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-2xl px-4 py-3 shrink-0" style={{ minWidth: 110 }}>
      <div className="text-[10px] text-muted font-bold uppercase tracking-wide mb-1">{label}</div>
      <div className="text-base font-extrabold whitespace-nowrap">{value}</div>
    </div>
  );
}
