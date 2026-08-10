"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Sparkles, MapPin, Share2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtPace, fmtTime, fmtDate, isThisMonth, isThisYear, currentMonthLabel, currentYearLabel, periodProgress } from "@/lib/utils";
import Avatar from "./Avatar";
import StravaTag from "./StravaTag";
import Podium from "./Podium";
import RegisterRunModal from "./RegisterRunModal";
import EditRunModal from "./EditRunModal";
import PosterModal from "./PosterModal";
import type { Journey, Profile, Run } from "@/lib/types";

export default function JourneyClient({
  journey,
  members,
  initialRuns,
  currentUserId,
  allJourneys,
}: {
  journey: Journey;
  members: Profile[];
  initialRuns: Run[];
  currentUserId: string;
  allJourneys: { id: string; title: string; theme_a: string; theme_b: string }[];
}) {
  const supabase = createClient();
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [periodView, setPeriodView] = useState<"monthly" | "annual">(journey.period_monthly ? "monthly" : "annual");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<Run | null>(null);
  const [posterOpen, setPosterOpen] = useState(false);
  const [aiComment, setAiComment] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [stravaSyncing, setStravaSyncing] = useState(false);
  const [stravaSyncMsg, setStravaSyncMsg] = useState("");

  const showToggle = journey.period_monthly && journey.period_annual;
  const goalKm = periodView === "monthly" ? journey.monthly_goal_km ?? 0 : journey.annual_goal_km ?? 0;
  const periodLabel = periodView === "monthly" ? currentMonthLabel() : currentYearLabel();

  const periodRuns = useMemo(
    () => runs.filter((r) => (periodView === "monthly" ? isThisMonth(r.created_at) : isThisYear(r.created_at))),
    [runs, periodView]
  );

  const totalKm = useMemo(() => periodRuns.reduce((s, r) => s + Number(r.km), 0), [periodRuns]);
  const pct = goalKm ? Math.min(100, Math.round((totalKm / goalKm) * 100)) : 0;
  const timeProgress = useMemo(() => periodProgress(periodView), [periodView]);

  const memberTotals = useMemo(() => {
    return members
      .map((m) => {
        const mine = periodRuns.filter((r) => r.user_id === m.id);
        const km = mine.reduce((s, r) => s + Number(r.km), 0);
        const timeSec = mine.reduce((s, r) => s + r.time_sec, 0);
        return { ...m, km, runsCount: mine.length, timeSec };
      })
      .sort((a, b) => b.km - a.km);
  }, [members, periodRuns]);

  async function reloadRuns() {
    const { data } = await supabase
      .from("runs")
      .select("*")
      .eq("journey_id", journey.id)
      .order("created_at", { ascending: false });
    setRuns(data ?? []);
    generateComment(data ?? []);
  }

  async function refreshRuns() {
    const { data } = await supabase
      .from("runs")
      .select("*")
      .eq("journey_id", journey.id)
      .order("created_at", { ascending: false });
    setRuns(data ?? []);
    const comment = await generateComment(data ?? []);

    const runnerName = members.find((m) => m.id === currentUserId)?.name ?? "Alguém";
    fetch("/api/notify-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journeyId: journey.id, runnerId: currentUserId, runnerName, comment }),
    }).catch(() => {});
  }

  async function generateComment(currentRuns: Run[]) {
    setAiLoading(true);
    const relevant = currentRuns.filter((r) =>
      periodView === "monthly" ? isThisMonth(r.created_at) : isThisYear(r.created_at)
    );
    const totals = members
      .map((m) => {
        const km = relevant.filter((r) => r.user_id === m.id).reduce((s, r) => s + Number(r.km), 0);
        return { name: m.name, km };
      })
      .sort((a, b) => b.km - a.km);
    const standings = totals.map((m, i) => `${i + 1}º ${m.name} - ${m.km.toFixed(1)}km`).join(", ");
    const total = totals.reduce((s, m) => s + m.km, 0);

    try {
      const res = await fetch("/api/narrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standings,
          goalKm: goalKm || "sem meta",
          totalKm: total.toFixed(1),
          daysLeft: timeProgress.daysLeft,
          previousComment: aiComment || undefined,
          narratorStyle: journey.narrator_style,
        }),
      });
      const data = await res.json();
      setAiComment(data.comment);
      return data.comment as string;
    } catch {
      const fallback = `${totals[0]?.name} lidera com ${totals[0]?.km.toFixed(1)}km.`;
      setAiComment(fallback);
      return fallback;
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    generateComment(runs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodView]);

  const me = memberTotals.find((m) => m.id === currentUserId);
  const monthRuns = useMemo(() => runs.filter((r) => isThisMonth(r.created_at)), [runs]);
  const myRuns = monthRuns.filter((r) => r.user_id === currentUserId);

  const previousMonthLabel = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, []);

  const previousMonthTotals = useMemo(() => {
    const now = new Date();
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevRuns = runs.filter((r) => {
      const d = new Date(r.created_at);
      return d.getFullYear() === prevDate.getFullYear() && d.getMonth() === prevDate.getMonth();
    });
    return members
      .map((m) => {
        const mine = prevRuns.filter((r) => r.user_id === m.id);
        const km = mine.reduce((s, r) => s + Number(r.km), 0);
        const timeSec = mine.reduce((s, r) => s + r.time_sec, 0);
        return { ...m, km, runsCount: mine.length, timeSec };
      })
      .sort((a, b) => b.km - a.km);
  }, [members, runs]);
  const hasPreviousMonthData = previousMonthTotals.some((m) => m.km > 0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasPreviousMonthData && carouselRef.current) {
      carouselRef.current.scrollLeft = carouselRef.current.clientWidth;
    }
  }, [hasPreviousMonthData]);

  async function handleInvite() {
    const url = `${window.location.origin}/join/${journey.id}`;
    if (navigator.share) {
      navigator.share({ title: journey.title, text: `Vem correr comigo na jornada "${journey.title}"!`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      setInviteMsg("Link copiado!");
      setTimeout(() => setInviteMsg(""), 2000);
    }
  }

  async function handleStravaRefresh() {
    setStravaSyncing(true);
    setStravaSyncMsg("");
    try {
      // Busca desde o início do período mais amplo da jornada, pra também servir como recuperação
      // caso alguma corrida tenha sido apagada sem querer — o Strava ainda tem o histórico real.
      const sinceDate = journey.period_annual
        ? new Date(new Date().getFullYear(), 0, 1).toISOString()
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const res = await fetch("/api/strava/import-for-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId: journey.id, sinceDate }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStravaSyncMsg(data.error || "Não consegui sincronizar agora.");
      } else if (data.imported > 0) {
        setStravaSyncMsg(`${data.imported} corrida(s) do Strava sincronizada(s)!`);
        await reloadRuns();
      } else {
        setStravaSyncMsg("Tudo em dia — nenhuma corrida nova do Strava.");
      }
    } catch {
      setStravaSyncMsg("Não consegui sincronizar agora.");
    } finally {
      setStravaSyncing(false);
      setTimeout(() => setStravaSyncMsg(""), 4000);
    }
  }

  return (
    <div className="max-w-md mx-auto pb-28 relative min-h-screen">
      <div
        className="px-5 pt-6 pb-5"
        style={{
          background: `radial-gradient(120% 140% at 20% -10%, ${journey.theme_b}55, transparent), radial-gradient(120% 140% at 100% 0%, ${journey.theme_a}44, transparent)`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <Link href="/home" className="flex items-center gap-1 text-sm font-bold text-muted w-fit">
            <ChevronLeft size={16} /> Home
          </Link>
          <button onClick={handleInvite} className="flex items-center gap-1.5 text-xs font-bold" style={{ color: journey.theme_a }}>
            <Share2 size={13} /> {inviteMsg || "Convidar"}
          </button>
        </div>

        <div className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: journey.theme_a }}>
          {journey.season}
        </div>
        <div className="font-display text-4xl mt-0.5">{journey.title}</div>

        <div className="flex items-start gap-2 mt-2.5 text-sm font-semibold text-[#D8DCF5] min-h-[36px]">
          <Sparkles size={15} color="#FFC145" className="shrink-0 mt-0.5" />
          <span>{aiLoading ? "O narrador está pensando..." : aiComment}</span>
        </div>

        {showToggle && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setPeriodView("monthly")}
              className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: periodView === "monthly" ? `${journey.theme_a}33` : "rgba(255,255,255,0.06)",
                color: periodView === "monthly" ? journey.theme_a : "#8890B5",
              }}
            >
              Mensal
            </button>
            <button
              onClick={() => setPeriodView("annual")}
              className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: periodView === "annual" ? `${journey.theme_b}33` : "rgba(255,255,255,0.06)",
                color: periodView === "annual" ? journey.theme_b : "#8890B5",
              }}
            >
              Anual
            </button>
          </div>
        )}

        <div className="mt-4">
          <div className="flex justify-between items-baseline mb-1">
            <div className="text-[11px] text-muted font-bold capitalize">{periodLabel}</div>
            <div className="text-[11px] text-muted font-bold">{timeProgress.daysLeft} dias restantes</div>
          </div>
          <div className="flex justify-between text-sm font-extrabold mb-2">
            <span>{totalKm.toFixed(1)} km</span>
            <span className="text-muted">{pct}% de {goalKm} km</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${journey.theme_a}, ${journey.theme_b})` }}
            />
          </div>

          {goalKm > 0 && (
            <>
              <div className="flex justify-between items-center mt-2.5 mb-1">
                <span className="text-[10px] text-muted font-semibold uppercase tracking-wide">Tempo do período</span>
                <span className="text-[10px] font-bold" style={{ color: pct >= timeProgress.pct ? "#5CFF8F" : "#FF6B9D" }}>
                  {pct >= timeProgress.pct ? "Você está à frente do calendário" : "Você está atrás do calendário"}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-white/30" style={{ width: `${timeProgress.pct}%` }} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-5 pt-5">
        {hasPreviousMonthData ? (
          <>
            <div
              ref={carouselRef}
              className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-5 px-5"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="w-full shrink-0 snap-center pr-1">
                <div className="text-center text-[11px] font-extrabold uppercase tracking-wide text-muted mb-2 capitalize">
                  {previousMonthLabel}
                </div>
                <Podium memberTotals={previousMonthTotals} />
              </div>
              <div className="w-full shrink-0 snap-center pl-1">
                <div className="text-center text-[11px] font-extrabold uppercase tracking-wide text-muted mb-2">Mês atual</div>
                <Podium memberTotals={memberTotals} />
              </div>
            </div>
            <div className="text-center text-[10px] text-muted font-semibold mt-1 mb-1">
              deslize pro lado pra ver o mês anterior
            </div>
          </>
        ) : (
          <Podium memberTotals={memberTotals} />
        )}

        {memberTotals.filter((m) => m.km > 0).length >= 2 && (
          <button
            onClick={() => setPosterOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-extrabold mt-1 mb-2"
            style={{
              background: `linear-gradient(90deg, ${journey.theme_a}22, ${journey.theme_b}22)`,
              border: `1px solid ${journey.theme_a}55`,
              color: journey.theme_a,
            }}
          >
            <Sparkles size={15} /> Gerar imagem do ranking com IA
          </button>
        )}

        <div className="flex items-center justify-between mb-2.5 mt-6">
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted flex items-center gap-1.5">
            <MapPin size={14} color={journey.theme_a} /> Histórico deste mês
          </div>
          <button
            onClick={handleStravaRefresh}
            disabled={stravaSyncing}
            className="flex items-center gap-1 text-[11px] font-bold shrink-0"
            style={{ color: journey.theme_a }}
            title="Sincronizar corridas do Strava pra essa jornada"
          >
            <RefreshCw size={12} className={stravaSyncing ? "animate-spin" : ""} /> Strava
          </button>
        </div>
        {stravaSyncMsg && <div className="text-[11px] text-muted font-semibold mb-2 -mt-1">{stravaSyncMsg}</div>}
        {monthRuns.length === 0 && (
          <div className="text-sm text-muted bg-surface rounded-2xl p-4 mb-1">Nenhuma corrida registrada esse mês ainda.</div>
        )}
        <div className="bg-surface rounded-2xl p-1.5">
          {monthRuns.slice(0, 10).map((r, i) => {
            const member = members.find((m) => m.id === r.user_id)!;
            const isMine = r.user_id === currentUserId;
            return (
              <button
                key={r.id}
                onClick={() => isMine && setEditingRun(r)}
                disabled={!isMine}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 text-left"
                style={{ borderBottom: i < Math.min(monthRuns.length, 10) - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
              >
                <Avatar profile={member} size={28} />
                <div className="flex-1">
                  <div className="text-sm font-semibold flex items-center gap-1.5">
                    {member.name}
                    {r.source === "strava" && <StravaTag />}
                  </div>
                  <div className="text-[11px] text-muted">
                    {fmtPace(r.time_sec, Number(r.km))} /km · {fmtTime(r.time_sec)} min
                    {r.bpm ? ` · ${r.bpm} bpm` : ""}
                    {r.calories ? ` · ${r.calories} kcal` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold">{Number(r.km).toFixed(1)} km</div>
                  <div className="text-[10px] text-muted font-semibold">{fmtDate(r.created_at)}</div>
                </div>
              </button>
            );
          })}
        </div>

        {me && (
          <>
            <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5 mt-6">
              Sua contribuição <span className="normal-case font-semibold text-[10px]">(toque numa corrida pra editar)</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <StatCard label="Total" value={`${me.km.toFixed(1)} km`} />
              <StatCard label="Pace médio" value={`${fmtPace(me.timeSec, me.km)} /km`} />
              <StatCard label="Corridas" value={String(me.runsCount)} />
              <StatCard label="Tempo total" value={`${fmtTime(me.timeSec)} min`} />
            </div>
            {myRuns.length > 0 && (
              <div className="bg-surface rounded-2xl p-1.5">
                {myRuns.slice(0, 5).map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => setEditingRun(r)}
                    className="w-full flex items-center gap-3 px-2.5 py-2.5 text-left"
                    style={{ borderBottom: i < Math.min(myRuns.length, 5) - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-bold flex items-center gap-1.5">
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
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto">
        <button
          onClick={() => setRegisterOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-extrabold text-sm text-bg"
          style={{ background: `linear-gradient(90deg, ${journey.theme_a}, ${journey.theme_b})` }}
        >
          <Plus size={17} /> Registrar corrida
        </button>
      </div>

      {registerOpen && (
        <RegisterRunModal
          journeys={allJourneys}
          defaultJourneyIds={[journey.id]}
          userId={currentUserId}
          onClose={() => setRegisterOpen(false)}
          onRegistered={(ids) => {
            if (ids.includes(journey.id)) refreshRuns();
          }}
        />
      )}

      {editingRun && (
        <EditRunModal
          run={editingRun}
          themeA={journey.theme_a}
          themeB={journey.theme_b}
          onClose={() => setEditingRun(null)}
          onSaved={() => {
            setEditingRun(null);
            reloadRuns();
          }}
          onDeleted={() => {
            setEditingRun(null);
            reloadRuns();
          }}
        />
      )}

      {posterOpen && (
        <PosterModal
          journey={journey}
          memberTotals={memberTotals.filter((m) => m.km > 0)}
          narratorComment={aiComment}
          onClose={() => setPosterOpen(false)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-2xl p-3.5">
      <div className="text-[11px] text-muted font-bold mb-1.5">{label}</div>
      <div className="text-lg font-extrabold">{value}</div>
    </div>
  );
}
