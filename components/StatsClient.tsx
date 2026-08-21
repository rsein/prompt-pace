"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, LabelList } from "recharts";
import { fmtPace, fmtTime, fmtDate } from "@/lib/utils";
import StravaTag from "./StravaTag";
import PersonalRunModal from "./PersonalRunModal";

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
type YearData = { year: number; months: MonthData[] };
type PersonalRun = { km: number; time_sec: number; created_at: string; source: "strava" | "manual"; key: string };
type JourneyOption = { id: string; title: string; theme_a: string; theme_b: string };

const THEME_A = "#29F1D6";
const THEME_B = "#8B5CF6";

function monthGroupLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function StatsClient({
  stats,
  yearsData,
  runs,
  journeys,
  userId,
}: {
  stats: Stats;
  yearsData: YearData[];
  runs: PersonalRun[];
  journeys: JourneyOption[];
  userId: string;
}) {
  const [items, setItems] = useState(runs);
  const [editingRun, setEditingRun] = useState<PersonalRun | null>(null);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const visibleYears = yearsData.filter((y) => y.year === currentYear || y.months.some((m) => m.km > 0));
  const hasAnyData = visibleYears.some((y) => y.months.some((m) => m.km > 0));

  useEffect(() => {
    // abre já no último ano visível (o atual) — desliza pra trás pra ver os anos anteriores, se houver
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = carouselRef.current.scrollWidth;
    }
  }, []);

  const groups: { label: string; runs: PersonalRun[] }[] = [];
  for (const run of items) {
    const label = monthGroupLabel(run.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.runs.push(run);
    else groups.push({ label, runs: [run] });
  }

  const currentMonthLabel = monthGroupLabel(new Date().toISOString());
  const visibleGroups = showAllMonths ? groups : groups.filter((g) => g.label === currentMonthLabel);
  const hasOlderMonths = groups.some((g) => g.label !== currentMonthLabel);

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

      {hasAnyData && (
        <>
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5">Km por mês</div>
          {visibleYears.length === 1 ? (
            <div className="bg-surface rounded-2xl p-4 pt-6 mb-6" style={{ height: 210 }}>
              <div className="text-center text-[11px] font-extrabold text-muted mb-1">{visibleYears[0].year}</div>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={visibleYears[0].months} margin={{ top: 18, left: 0, right: 0 }}>
                  <defs>
                    <linearGradient id="barGrad-single" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={THEME_A} />
                      <stop offset="100%" stopColor={THEME_B} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#8890B5", fontSize: 10 }} interval={0} />
                  <Bar dataKey="km" fill="url(#barGrad-single)" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="km"
                      position="top"
                      formatter={(value: number) => (value > 0 ? value : "")}
                      style={{ fill: "#F4F6FF", fontSize: 10, fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <>
              <div
                ref={carouselRef}
                className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-5 px-5 mb-1"
                style={{ scrollbarWidth: "none" }}
              >
                {visibleYears.map((yearData) => (
                  <div key={yearData.year} className="w-full shrink-0 snap-center px-0.5">
                    <div className="bg-surface rounded-2xl p-4 pt-6" style={{ height: 210 }}>
                      <div className="text-center text-[11px] font-extrabold text-muted mb-1">{yearData.year}</div>
                      <ResponsiveContainer width="100%" height="88%">
                        <BarChart data={yearData.months} margin={{ top: 18, left: 0, right: 0 }}>
                          <defs>
                            <linearGradient id={`barGrad-${yearData.year}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={THEME_A} />
                              <stop offset="100%" stopColor={THEME_B} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#8890B5", fontSize: 10 }} interval={0} />
                          <Bar dataKey="km" fill={`url(#barGrad-${yearData.year})`} radius={[4, 4, 0, 0]}>
                            <LabelList
                              dataKey="km"
                              position="top"
                              formatter={(value: number) => (value > 0 ? value : "")}
                              style={{ fill: "#F4F6FF", fontSize: 10, fontWeight: 700 }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center text-[10px] text-muted font-semibold mb-6">deslize pro lado pra ver outros anos</div>
            </>
          )}
        </>
      )}

      <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5">
        {showAllMonths ? "Histórico completo" : "Este mês"}{" "}
        <span className="normal-case font-semibold text-[10px]">(toque numa corrida pra editar, excluir ou add numa jornada)</span>
      </div>

      {visibleGroups.length === 0 && (
        <div className="text-sm text-muted bg-surface rounded-2xl p-4 mb-2">
          {showAllMonths ? "Nenhuma corrida registrada ainda." : "Nenhuma corrida esse mês ainda."}
        </div>
      )}

      {visibleGroups.map((group) => (
        <div key={group.label} className="mb-4">
          <div className="text-[11px] text-muted font-bold mb-1.5 capitalize px-1">{group.label}</div>
          <div className="bg-surface rounded-2xl p-1.5">
            {group.runs.map((r, i) => (
              <button
                key={r.key}
                onClick={() => setEditingRun(r)}
                className="w-full flex items-center gap-2 px-2.5 py-2.5 text-left"
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
              </button>
            ))}
          </div>
        </div>
      ))}

      {!showAllMonths && hasOlderMonths && (
        <button
          onClick={() => setShowAllMonths(true)}
          className="w-full py-3 rounded-xl text-xs font-bold text-muted mb-2"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Mais registros (meses anteriores)
        </button>
      )}
      {showAllMonths && (
        <button
          onClick={() => setShowAllMonths(false)}
          className="w-full py-3 rounded-xl text-xs font-bold text-muted mb-2"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Mostrar só este mês
        </button>
      )}

      {editingRun && (
        <PersonalRunModal
          run={editingRun}
          userId={userId}
          journeys={journeys}
          onClose={() => setEditingRun(null)}
          onSaved={(updated) => {
            setItems((prev) => prev.map((r) => (r.key === editingRun.key ? { ...r, ...updated } : r)));
            setEditingRun(null);
          }}
          onDeleted={() => {
            setItems((prev) => prev.filter((r) => r.key !== editingRun.key));
            setEditingRun(null);
          }}
        />
      )}
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
