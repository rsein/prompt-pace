"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Sparkles, Trophy, User, MapPin, Bell, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtPace, fmtTime, isThisMonth, isThisYear, currentMonthLabel, currentYearLabel } from "@/lib/utils";
import { enablePushNotifications, disablePushNotifications, getPushSubscription, isPushSupported } from "@/lib/push";
import Avatar from "./Avatar";
import Podium from "./Podium";
import RegisterRunModal from "./RegisterRunModal";
import type { Journey, Profile, Run } from "@/lib/types";

export default function JourneyClient({
  journey,
  members,
  initialRuns,
  currentUserId,
}: {
  journey: Journey;
  members: Profile[];
  initialRuns: Run[];
  currentUserId: string;
}) {
  const supabase = createClient();
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [tab, setTab] = useState<"jornada" | "perfil">("jornada");
  const [periodView, setPeriodView] = useState<"monthly" | "annual">(journey.period_monthly ? "monthly" : "annual");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [aiComment, setAiComment] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState("");

  useEffect(() => {
    if (!isPushSupported()) return;
    getPushSubscription().then((sub) => setPushOn(!!sub));
  }, []);

  async function togglePush() {
    setPushBusy(true);
    setPushMsg("");
    try {
      if (pushOn) {
        await disablePushNotifications(currentUserId);
        setPushOn(false);
      } else {
        await enablePushNotifications(currentUserId);
        setPushOn(true);
      }
    } catch (err: unknown) {
      setPushMsg(err instanceof Error ? err.message : "Não consegui ativar as notificações.");
    } finally {
      setPushBusy(false);
    }
  }

  const showToggle = journey.period_monthly && journey.period_annual;
  const goalKm = periodView === "monthly" ? journey.monthly_goal_km ?? 0 : journey.annual_goal_km ?? 0;
  const periodLabel = periodView === "monthly" ? currentMonthLabel() : currentYearLabel();

  const periodRuns = useMemo(
    () => runs.filter((r) => (periodView === "monthly" ? isThisMonth(r.created_at) : isThisYear(r.created_at))),
    [runs, periodView]
  );

  const totalKm = useMemo(() => periodRuns.reduce((s, r) => s + Number(r.km), 0), [periodRuns]);
  const pct = goalKm ? Math.min(100, Math.round((totalKm / goalKm) * 100)) : 0;

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

  function daysLeftInPeriod() {
    const now = new Date();
    if (periodView === "monthly") {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
    }
    const end = new Date(now.getFullYear(), 11, 31);
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
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
          daysLeft: daysLeftInPeriod(),
          previousComment: aiComment || undefined,
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
  const myRank = memberTotals.findIndex((m) => m.id === currentUserId) + 1;
  const myRuns = runs.filter((r) => r.user_id === currentUserId);

  return (
    <div className="max-w-md mx-auto pb-28 relative min-h-screen">
      <div
        className="px-5 pt-6 pb-5"
        style={{
          background: `radial-gradient(120% 140% at 20% -10%, ${journey.theme_b}55, transparent), radial-gradient(120% 140% at 100% 0%, ${journey.theme_a}44, transparent)`,
        }}
      >
        <Link href="/home" className="flex items-center gap-1 text-sm font-bold text-muted mb-4 w-fit">
          <ChevronLeft size={16} /> Home
        </Link>

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
          <div className="text-[11px] text-muted font-bold mb-1 capitalize">{periodLabel}</div>
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
        </div>
      </div>

      <div className="flex border-b border-white/10">
        {[
          { id: "jornada" as const, label: "Jornada", icon: <Trophy size={14} /> },
          { id: "perfil" as const, label: "Perfil", icon: <User size={14} /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 text-center py-3 text-sm font-bold flex items-center justify-center gap-1.5"
            style={{
              color: tab === t.id ? journey.theme_a : "#8890B5",
              borderBottom: tab === t.id ? `2px solid ${journey.theme_a}` : "2px solid transparent",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "jornada" && (
        <div className="px-5">
          <Podium memberTotals={memberTotals} />

          <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5 flex items-center gap-1.5 mt-6">
            <MapPin size={14} color={journey.theme_a} /> Histórico
          </div>
          <div className="bg-surface rounded-2xl p-1.5">
            {runs.slice(0, 10).map((r, i) => {
              const member = members.find((m) => m.id === r.user_id)!;
              return (
                <div key={r.id} className="flex items-center gap-3 px-2.5 py-2.5" style={{ borderBottom: i < runs.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                  <Avatar profile={member} size={28} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{member.name}</div>
                    <div className="text-[11px] text-muted">
                      {fmtPace(r.time_sec, Number(r.km))} /km · {fmtTime(r.time_sec)} min
                      {r.bpm ? ` · ${r.bpm} bpm` : ""}
                      {r.calories ? ` · ${r.calories} kcal` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-extrabold">{Number(r.km).toFixed(1)} km</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "perfil" && me && (
        <div className="px-5">
          <div className="flex items-center gap-3.5 my-5">
            <Avatar profile={me} size={52} />
            <div>
              <div className="text-lg font-extrabold">{me.name}</div>
              <div className="text-xs text-muted font-semibold">{myRank}º lugar na jornada</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-6">
            <StatCard label="Total" value={`${me.km.toFixed(1)} km`} />
            <StatCard label="Pace médio" value={`${fmtPace(me.timeSec, me.km)} /km`} />
            <StatCard label="Corridas" value={String(me.runsCount)} />
            <StatCard label="Tempo total" value={`${fmtTime(me.timeSec)} min`} />
          </div>

          <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5">Suas corridas</div>
          <div className="bg-surface rounded-2xl p-1.5 mb-6">
            {myRuns.length === 0 && <div className="p-4 text-sm text-muted">Você ainda não registrou nenhuma corrida.</div>}
            {myRuns.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 px-2.5 py-2.5" style={{ borderBottom: i < myRuns.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <div className="flex-1">
                  <div className="text-sm font-bold">{fmtPace(r.time_sec, Number(r.km))} /km · {fmtTime(r.time_sec)} min</div>
                </div>
                <div className="text-sm font-extrabold">{Number(r.km).toFixed(1)} km</div>
              </div>
            ))}
          </div>

          <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5">Notificações</div>
          <div className="bg-surface rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {pushOn ? <Bell size={16} color={journey.theme_a} /> : <BellOff size={16} className="text-muted" />}
                <div>
                  <div className="text-sm font-bold">Avisar quando alguém registrar</div>
                  <div className="text-[11px] text-muted">Recebe o comentário do narrador no celular</div>
                </div>
              </div>
              <button
                onClick={togglePush}
                disabled={pushBusy}
                className="px-3.5 py-2 rounded-full text-xs font-bold shrink-0"
                style={{
                  background: pushOn ? "rgba(255,255,255,0.08)" : `${journey.theme_a}33`,
                  color: pushOn ? "#8890B5" : journey.theme_a,
                }}
              >
                {pushBusy ? "..." : pushOn ? "Desativar" : "Ativar"}
              </button>
            </div>
            {pushMsg && <div className="text-[11px] text-red-400 font-semibold mt-2">{pushMsg}</div>}
            {!isPushSupported() && (
              <div className="text-[11px] text-muted mt-2">
                No iPhone, adiciona o Prompt & Pace à Tela de Início (Compartilhar → Adicionar à Tela de Início) pra notificações funcionarem.
              </div>
            )}
          </div>
        </div>
      )}

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
          journeyId={journey.id}
          userId={currentUserId}
          themeA={journey.theme_a}
          themeB={journey.theme_b}
          onClose={() => setRegisterOpen(false)}
          onRegistered={refreshRuns}
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
