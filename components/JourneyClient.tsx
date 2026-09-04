"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Sparkles, MapPin, Share2, RefreshCw, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtPace, fmtTime, fmtDate, isThisMonth, isThisYear, currentMonthLabel, currentYearLabel, periodProgress, paceColor } from "@/lib/utils";
import Avatar from "./Avatar";
import StravaTag from "./StravaTag";
import Podium from "./Podium";
import RegisterRunModal from "./RegisterRunModal";
import EditRunModal from "./EditRunModal";
import PosterModal from "./PosterModal";
import RunReactions, { type Reaction } from "./RunReactions";
import RouteMap from "./RouteMap";
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
  const router = useRouter();
  const isCreator = journey.created_by === currentUserId;
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function handleLeave() {
    setLeaving(true);
    await supabase.from("journey_members").delete().eq("journey_id", journey.id).eq("user_id", currentUserId);
    setLeaving(false);
    router.push("/home");
    router.refresh();
  }
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

  async function notifyJourneys(ids: string[], richComment?: string) {
    const runnerName = members.find((m) => m.id === currentUserId)?.name ?? "Alguém";
    ids.forEach((id) => {
      fetch("/api/notify-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyId: id,
          runnerId: currentUserId,
          runnerName,
          comment: id === journey.id ? richComment : undefined,
        }),
      }).catch(() => {});
    });
  }

  async function refreshRuns(allRegisteredIds: string[] = [journey.id]) {
    const { data } = await supabase
      .from("runs")
      .select("*")
      .eq("journey_id", journey.id)
      .order("created_at", { ascending: false });

    let richComment: string | undefined;
    if (allRegisteredIds.includes(journey.id)) {
      setRuns(data ?? []);
      richComment = await generateComment(data ?? []);
    }

    notifyJourneys(allRegisteredIds, richComment);
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
          soloMode: members.length === 1,
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
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);

  async function loadReactions(runIds: string[]) {
    if (runIds.length === 0) {
      setReactions({});
      return;
    }
    const { data } = await supabase.from("run_reactions").select("*").in("run_id", runIds);
    const grouped: Record<string, Reaction[]> = {};
    (data ?? []).forEach((r: Reaction) => {
      if (!grouped[r.run_id]) grouped[r.run_id] = [];
      grouped[r.run_id].push(r);
    });
    setReactions(grouped);
  }

  useEffect(() => {
    loadReactions(monthRuns.map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs]);

  type ClosedMonth = {
    year: number;
    month: number; // 1-12
    label: string;
    result: { goal_km: number; achieved_km: number; completed: boolean };
    totals: typeof memberTotals;
  };

  function computeMonthTotals(year: number, month0Indexed: number) {
    const monthRunsFor = runs.filter((r) => {
      const d = new Date(r.created_at);
      return d.getFullYear() === year && d.getMonth() === month0Indexed;
    });
    return members
      .map((m) => {
        const mine = monthRunsFor.filter((r) => r.user_id === m.id);
        const km = mine.reduce((s, r) => s + Number(r.km), 0);
        const timeSec = mine.reduce((s, r) => s + r.time_sec, 0);
        return { ...m, km, runsCount: mine.length, timeSec };
      })
      .sort((a, b) => b.km - a.km);
  }

  const [closedMonths, setClosedMonths] = useState<ClosedMonth[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const currentMonthPanelRef = useRef<HTMLDivElement>(null);

  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationResult, setCelebrationResult] = useState<ClosedMonth | null>(null);
  const [posterSourceTotals, setPosterSourceTotals] = useState<typeof memberTotals | null>(null);

  useEffect(() => {
    supabase
      .from("journey_month_results")
      .select("year, month, goal_km, achieved_km, completed")
      .eq("journey_id", journey.id)
      .order("year", { ascending: true })
      .order("month", { ascending: true })
      .then(({ data }) => {
        const rows = (data ?? []) as { year: number; month: number; goal_km: number; achieved_km: number; completed: boolean }[];
        const built: ClosedMonth[] = rows.map((r) => ({
          year: r.year,
          month: r.month,
          label: new Date(r.year, r.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
          result: { goal_km: r.goal_km, achieved_km: r.achieved_km, completed: r.completed },
          totals: computeMonthTotals(r.year, r.month - 1),
        }));
        setClosedMonths(built);

        // Celebração automática: só o mês fechado mais recente, e só se ainda não foi visto
        const latest = built[built.length - 1];
        if (latest) {
          const seenKey = `pp-seen-month-${journey.id}-${latest.year}-${latest.month}`;
          if (!localStorage.getItem(seenKey)) {
            setCelebrationResult(latest);
            setShowCelebration(true);
          }
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.id, runs]);

  function dismissCelebration() {
    if (celebrationResult) {
      const seenKey = `pp-seen-month-${journey.id}-${celebrationResult.year}-${celebrationResult.month}`;
      localStorage.setItem(seenKey, "1");
    }
    setShowCelebration(false);
  }

  useEffect(() => {
    if (closedMonths.length > 0 && currentMonthPanelRef.current) {
      currentMonthPanelRef.current.scrollIntoView({ inline: "start", block: "nearest" });
    }
  }, [closedMonths.length]);

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

  const isFinalStretch = goalKm > 0 && timeProgress.daysLeft <= 5;
  const onTrack = pct >= timeProgress.pct;
  const barColor = goalKm > 0 ? paceColor(pct, timeProgress.pct) : null;

  const soloMode = members.length === 1;
  const motivationalPhrase = useMemo(() => {
    if (goalKm === 0) return null;
    if (timeProgress.pct < 10) {
      return {
        title: "Começando agora!",
        subtitle: soloMode ? "Define logo seu ritmo pro mês." : "Bora definir logo o ritmo do grupo.",
      };
    }
    if (onTrack) {
      return {
        title: soloMode ? "Você está indo bem!" : "Vocês estão indo bem!",
        subtitle: soloMode ? "Continue assim pra bater a meta." : "Continuem assim pra bater a meta.",
      };
    }
    if (timeProgress.pct > 80) {
      return {
        title: "Reta final!",
        subtitle: soloMode ? "Acelera que ainda dá tempo." : "Acelerem que ainda dá tempo.",
      };
    }
    return {
      title: "Ainda dá tempo!",
      subtitle: soloMode ? "De recuperar o ritmo — vamos lá." : "De recuperar o ritmo — vamos, time!",
    };
  }, [goalKm, timeProgress.pct, onTrack, soloMode]);

  return (
    <div className="max-w-md mx-auto pb-28 relative min-h-screen">
      <div
        className="px-5 pt-6 pb-5"
        style={{
          background: `radial-gradient(120% 140% at 20% -10%, ${journey.theme_b}55, transparent), radial-gradient(120% 140% at 100% 0%, ${journey.theme_a}44, transparent)`,
          border: isFinalStretch ? `2px solid ${onTrack ? "#5CFF8F" : "#FF4D4D"}` : "2px solid transparent",
          transition: "border-color 0.3s ease",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <Link href="/home" className="flex items-center gap-1 text-sm font-bold text-muted w-fit">
            <ChevronLeft size={16} /> Home
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={handleInvite} className="flex items-center gap-1.5 text-xs font-bold" style={{ color: journey.theme_a }}>
              <Share2 size={13} /> {inviteMsg || "Convidar"}
            </button>
            {!isCreator && (
              <button
                onClick={() => setConfirmingLeave(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-red-400"
              >
                <LogOut size={13} /> Sair
              </button>
            )}
          </div>
        </div>

        {confirmingLeave && (
          <div className="bg-surface2 rounded-2xl p-4 mb-4">
            <div className="text-sm font-bold mb-1">Sair de "{journey.title}"?</div>
            <div className="text-xs text-muted mb-3 leading-relaxed">
              Você deixa de ver essa jornada e sai do ranking. Suas corridas continuam registradas pros outros, e dá pra
              voltar se alguém te convidar de novo.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingLeave(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-red-500"
                style={{ opacity: leaving ? 0.7 : 1 }}
              >
                {leaving ? "Saindo..." : "Sim, sair"}
              </button>
            </div>
          </div>
        )}

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
              style={{
                width: `${pct}%`,
                background: barColor ?? `linear-gradient(90deg, ${journey.theme_a}, ${journey.theme_b})`,
              }}
            />
          </div>

          {goalKm > 0 && (
            <>
              <div className="flex justify-between items-center mt-2.5 mb-1">
                <span className="text-[10px] text-muted font-semibold uppercase tracking-wide">Tempo do período</span>
                <span className="text-[10px] font-bold" style={{ color: barColor ?? "#5CFF8F" }}>
                  {onTrack ? "Você está à frente do calendário" : "Você está atrás do calendário"}
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
        {closedMonths.length > 0 ? (
          <>
            <div
              ref={carouselRef}
              className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-5 px-5"
              style={{ scrollbarWidth: "none" }}
            >
              {closedMonths.map((cm) => (
                <div key={`${cm.year}-${cm.month}`} className="w-full shrink-0 snap-center px-0.5">
                  <div className="text-center text-[11px] font-extrabold uppercase tracking-wide text-muted mb-2 capitalize">
                    {cm.label}
                  </div>
                  <div
                    className="rounded-2xl p-3.5 mb-3 text-center flex flex-col items-center justify-center"
                    style={{
                      minHeight: 74,
                      background: cm.result.completed ? "rgba(92,255,143,0.1)" : "rgba(255,77,77,0.1)",
                      border: `1px solid ${cm.result.completed ? "#5CFF8F" : "#FF4D4D"}`,
                    }}
                  >
                    <div className="text-sm font-extrabold" style={{ color: cm.result.completed ? "#5CFF8F" : "#FF4D4D" }}>
                      {cm.result.completed ? "Parabéns, Meta Concluída! 🎉" : "Não foi dessa vez! 😕"}
                    </div>
                    <div className="text-[11px] text-muted mt-1">
                      {cm.result.achieved_km.toFixed(1)}km de {cm.result.goal_km}km da meta
                      {!cm.result.completed &&
                        ` — faltaram ${(cm.result.goal_km - cm.result.achieved_km).toFixed(1)}km`}
                    </div>
                  </div>
                  <Podium memberTotals={cm.totals} />
                </div>
              ))}
              <div ref={currentMonthPanelRef} className="w-full shrink-0 snap-center px-0.5">
                <div className="text-center text-[11px] font-extrabold uppercase tracking-wide text-muted mb-2">Mês atual</div>
                {motivationalPhrase ? (
                  <div
                    className="rounded-2xl p-3.5 mb-3 text-center flex flex-col items-center justify-center"
                    style={{
                      minHeight: 74,
                      background: `${barColor ?? "#5CFF8F"}1A`,
                      border: `1px solid ${barColor ?? "#5CFF8F"}`,
                    }}
                  >
                    <div className="text-sm font-extrabold" style={{ color: barColor ?? "#5CFF8F" }}>
                      {motivationalPhrase.title}
                    </div>
                    <div className="text-[11px] text-muted mt-1">{motivationalPhrase.subtitle}</div>
                  </div>
                ) : (
                  <div style={{ minHeight: 74 }} className="mb-3" />
                )}
                <Podium memberTotals={memberTotals} />
              </div>
            </div>
            <div className="text-center text-[10px] text-muted font-semibold mt-1 mb-1">
              deslize pro lado pra ver meses anteriores
            </div>
          </>
        ) : (
          <Podium memberTotals={memberTotals} />
        )}

        {memberTotals.filter((m) => m.km > 0).length >= 1 && (
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
              <div
                key={r.id}
                className="px-2.5 py-2.5"
                style={{ borderBottom: i < Math.min(monthRuns.length, 10) - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
              >
                <div
                  role="button"
                  tabIndex={isMine ? 0 : -1}
                  onClick={() => isMine && setEditingRun(r)}
                  className="w-full flex items-center gap-3 text-left"
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
                </div>

                <div className="mt-1.5 pl-[43px]">
                  <RunReactions
                    runId={r.id}
                    ownerId={r.user_id}
                    journeyId={journey.id}
                    currentUserId={currentUserId}
                    currentUserName={members.find((m) => m.id === currentUserId)?.name ?? ""}
                    reactions={reactions[r.id] ?? []}
                    onChange={() => loadReactions(monthRuns.map((rr) => rr.id))}
                  />
                </div>
                {r.polyline && i !== 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedMapId(expandedMapId === r.id ? null : r.id);
                    }}
                    className="mt-1.5 ml-[43px] flex items-center gap-1 text-[11px] font-bold"
                    style={{ color: journey.theme_a }}
                  >
                    <MapPin size={11} /> {expandedMapId === r.id ? "Esconder mapa" : "Ver mapa"}
                  </button>
                )}
                {((i === 0 && r.polyline) || (expandedMapId === r.id && r.polyline)) && (
                  <div className="mt-2.5">
                    <RouteMap polyline={r.polyline} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {me && (
          <>
            <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5 mt-6">
              Sua contribuição
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <StatCard label="Total" value={`${me.km.toFixed(1)} km`} />
              <StatCard label="Pace médio" value={`${fmtPace(me.timeSec, me.km)} /km`} />
              <StatCard label="Corridas" value={String(me.runsCount)} />
              <StatCard label="Tempo total" value={`${fmtTime(me.timeSec)} min`} />
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40">
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
          onRegistered={(ids) => refreshRuns(ids)}
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
          memberTotals={posterSourceTotals ?? memberTotals.filter((m) => m.km > 0)}
          allMembers={members}
          narratorComment={posterSourceTotals ? undefined : aiComment}
          onClose={() => {
            setPosterOpen(false);
            setPosterSourceTotals(null);
          }}
        />
      )}

      {showCelebration && celebrationResult && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50">
          <div className="w-full max-w-md mx-auto bg-surface2 rounded-t-3xl p-6 pb-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"
              style={{ background: celebrationResult.result.completed ? "rgba(92,255,143,0.15)" : "rgba(255,77,77,0.15)" }}
            >
              {celebrationResult.result.completed ? "🎉" : "😕"}
            </div>
            <div
              className="font-display text-3xl mb-1"
              style={{ color: celebrationResult.result.completed ? "#5CFF8F" : "#FF4D4D" }}
            >
              {celebrationResult.result.completed ? "Parabéns, Meta Concluída!" : "Não foi dessa vez!"}
            </div>
            <div className="text-xs text-muted uppercase font-bold tracking-wide capitalize mb-5">{celebrationResult.label}</div>

            <div className="bg-surface rounded-2xl p-5 mb-5">
              <div className="text-4xl font-extrabold mb-1">
                {celebrationResult.result.achieved_km.toFixed(1)}
                <span className="text-lg text-muted"> / {celebrationResult.result.goal_km}km</span>
              </div>
              <div className="text-xs text-muted">
                {celebrationResult.result.completed
                  ? `${(celebrationResult.result.achieved_km - celebrationResult.result.goal_km).toFixed(1)}km acima da meta`
                  : `Faltaram ${(celebrationResult.result.goal_km - celebrationResult.result.achieved_km).toFixed(1)}km`}
              </div>
            </div>

            <button
              onClick={() => {
                setPosterSourceTotals(celebrationResult.totals);
                dismissCelebration();
                setPosterOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm text-bg mb-2.5"
              style={{ background: "linear-gradient(90deg, #29F1D6, #8B5CF6)" }}
            >
              <Sparkles size={16} /> Gerar imagem do resultado
            </button>
            <button
              onClick={dismissCelebration}
              className="w-full py-3.5 rounded-2xl font-bold text-sm"
              style={{ border: "1px solid rgba(255,255,255,0.12)" }}
            >
              Fechar
            </button>
          </div>
        </div>
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
