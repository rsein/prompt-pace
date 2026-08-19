"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Play, MapPin, Sun, CloudRain } from "lucide-react";
import JourneyFormModal from "./JourneyFormModal";
import JourneyCardMenu from "./JourneyCardMenu";
import RegisterRunModal from "./RegisterRunModal";
import PendingInvites from "./PendingInvites";
import Avatar from "./Avatar";
import { periodProgress, fmtPace } from "@/lib/utils";
import { ensurePushSubscription } from "@/lib/push";
import type { Journey, Profile } from "@/lib/types";

type WeatherInfo = {
  city: string | null;
  tempC: number | null;
  description: string;
  isGoodForRunning: boolean;
  phrase: string | null;
};

type JourneyWithStats = Journey & {
  monthlyKm: number;
  annualKm: number;
  lastActivity: string;
};

type MyStats = {
  monthlyKm: number;
  annualKm: number;
  bestPaceSec: number | null;
  avgPaceSec: number | null;
  hoursSinceLastRun: number | null;
};

export default function HomeClient({
  userId,
  profile,
  journeys,
  myStats,
}: {
  userId: string;
  profile: Profile | null;
  journeys: JourneyWithStats[];
  myStats: MyStats;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingJourney, setEditingJourney] = useState<Journey | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", ""),
    []
  );

  // Se a notificação já tinha sido autorizada antes mas a inscrição se perdeu (reinstalação do
  // app, troca de service worker etc), reativa sozinho aqui, sem precisar a pessoa notar e ir
  // mexer no Perfil de novo.
  useEffect(() => {
    ensurePushSubscription(userId);
  }, [userId]);

  // Sincroniza com o Strava sozinho sempre que a Home abre — sem precisar clicar em nada.
  // Limita a 1x a cada 5 minutos por navegador, pra não gastar à toa o limite de chamadas do Strava.
  useEffect(() => {
    const THROTTLE_MS = 5 * 60 * 1000;
    const lastSync = Number(sessionStorage.getItem("stravaAutoSyncAt") || 0);
    if (Date.now() - lastSync < THROTTLE_MS) return;

    (async () => {
      try {
        const statusData = await fetch("/api/wearables/status").then((r) => r.json());
        const stravaConnected = (statusData.statuses ?? []).find(
          (s: { provider: string; connected: boolean }) => s.provider === "strava"
        )?.connected;
        if (!stravaConnected) return;

        sessionStorage.setItem("stravaAutoSyncAt", String(Date.now()));
        const res = await fetch("/api/strava/sync", { method: "POST" });
        const data = await res.json();
        if (data.imported > 0) router.refresh();
      } catch {
        // sincronização automática é só um bônus — se falhar, a pessoa ainda pode sincronizar manual
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const hoursParam =
            myStats.hoursSinceLastRun !== null ? `&hoursSinceLastRun=${myStats.hoursSinceLastRun.toFixed(1)}` : "";
          const res = await fetch(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}${hoursParam}`);
          if (res.ok) setWeather(await res.json());
        } catch {
          // sem clima, sem problema — a tela funciona igual sem essa informação
        }
      },
      () => {}, // usuário negou localização — segue sem mostrar nada, sem incomodar
      { timeout: 8000 }
    );
  }, []);

  const sorted = useMemo(
    () => [...journeys].sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()),
    [journeys]
  );

  function refresh() {
    router.refresh();
  }

  function handleRegisterClick() {
    if (journeys.length === 0) return;
    setRegisterOpen(true);
  }

  const defaultJourneyId = sorted[0]?.id;

  return (
    <div className="px-6 py-8 max-w-md mx-auto pb-28">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-xl tracking-wide">PROMPT & PACE</div>
        <div className="text-[11px] text-muted font-bold capitalize">{todayLabel}</div>
      </div>

      <div className="mb-4 min-h-[40px]">
        {weather && weather.tempC !== null && (
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted font-semibold">
              {weather.isGoodForRunning ? (
                <Sun size={12} className="text-[#FFC145]" />
              ) : (
                <CloudRain size={12} className="text-[#7DA6FF]" />
              )}
              {weather.city && (
                <>
                  <MapPin size={11} /> {weather.city} ·
                </>
              )}
              <span>{Math.round(weather.tempC)}°C · {weather.description}</span>
            </div>
            {weather.phrase && <div className="text-[11px] text-muted italic mt-1 leading-snug">{weather.phrase}</div>}
          </div>
        )}
      </div>

      {profile && (
        <Link href="/profile" className="flex items-center gap-2.5 mb-4 w-fit">
          <Avatar profile={profile} size={34} />
          <span className="text-sm font-bold">{profile.name}</span>
        </Link>
      )}

      {(myStats.monthlyKm > 0 || myStats.annualKm > 0) && (
        <Link href="/stats" className="block mb-6">
          <div className="grid grid-cols-2 gap-2.5">
            <MiniStat label="Este mês" value={`${myStats.monthlyKm.toFixed(1)} km`} />
            <MiniStat label="Este ano" value={`${myStats.annualKm.toFixed(1)} km`} />
            <MiniStat label="Melhor pace" value={myStats.bestPaceSec ? `${fmtPace(myStats.bestPaceSec, 1)} /km` : "—"} />
            <MiniStat label="Pace médio" value={myStats.avgPaceSec ? `${fmtPace(myStats.avgPaceSec, 1)} /km` : "—"} />
          </div>
          <div className="text-[10px] text-muted font-bold text-center mt-2">Toque pra ver estatísticas completas →</div>
        </Link>
      )}

      <PendingInvites userId={userId} />

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted font-bold">Bem-vindo de volta</div>
          <div className="font-display text-4xl mt-1">Suas jornadas</div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-r from-[#29F1D6] to-[#8B5CF6] text-bg shrink-0 mt-1"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {sorted.length === 0 && (
        <div className="text-sm text-muted bg-surface rounded-2xl p-5 mb-4">
          Você ainda não está em nenhuma jornada. Cria a primeira no botão + aí em cima.
        </div>
      )}

      {sorted.map((j) => {
        const pct = j.period_monthly
          ? Math.min(100, Math.round((j.monthlyKm / (j.monthly_goal_km || 1)) * 100))
          : Math.min(100, Math.round((j.annualKm / (j.annual_goal_km || 1)) * 100));
        const km = j.period_monthly ? j.monthlyKm : j.annualKm;
        const goal = j.period_monthly ? j.monthly_goal_km : j.annual_goal_km;
        const daysLeft = periodProgress(j.period_monthly ? "monthly" : "annual").daysLeft;

        return (
          <Link
            key={j.id}
            href={`/journey/${j.id}`}
            className="block rounded-2xl p-5 mb-3 border relative"
            style={{
              background: `linear-gradient(135deg, ${j.theme_a}22, ${j.theme_b}33), #0F1329`,
              borderColor: `${j.theme_a}44`,
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: j.theme_a }}>
                  {j.season}
                </div>
                <div className="font-display text-2xl mt-0.5">{j.title}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-muted font-bold whitespace-nowrap">{daysLeft}d restantes</span>
                <JourneyCardMenu journey={j} currentUserId={userId} onEdit={() => setEditingJourney(j)} onDeleted={refresh} />
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-sm font-bold mb-1.5">
                <span>{km.toFixed(1)} km</span>
                <span className="text-muted">meta {goal} km</span>
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

      {journeys.length > 0 && (
        <button
          onClick={handleRegisterClick}
          className="fixed bottom-4 left-4 right-4 max-w-md mx-auto flex items-center justify-center gap-2 py-4 rounded-2xl font-extrabold text-sm text-bg bg-gradient-to-r from-[#29F1D6] to-[#8B5CF6]"
        >
          <Play size={16} fill="#05070F" /> Registrar corrida
        </button>
      )}

      {createOpen && (
        <JourneyFormModal userId={userId} onClose={() => setCreateOpen(false)} onSaved={refresh} />
      )}

      {editingJourney && (
        <JourneyFormModal
          userId={userId}
          journey={editingJourney}
          onClose={() => setEditingJourney(null)}
          onSaved={refresh}
        />
      )}

      {registerOpen && (
        <RegisterRunModal
          journeys={journeys}
          defaultJourneyIds={defaultJourneyId ? [defaultJourneyId] : []}
          userId={userId}
          onClose={() => setRegisterOpen(false)}
          onRegistered={refresh}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-xl px-3.5 py-3">
      <div className="text-[10px] text-muted font-bold uppercase tracking-wide mb-1">{label}</div>
      <div className="text-base font-extrabold">{value}</div>
    </div>
  );
}
