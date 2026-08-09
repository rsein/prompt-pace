"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Play } from "lucide-react";
import JourneyFormModal from "./JourneyFormModal";
import JourneyCardMenu from "./JourneyCardMenu";
import RegisterRunModal from "./RegisterRunModal";
import Avatar from "./Avatar";
import type { Journey, Profile } from "@/lib/types";

type JourneyWithStats = Journey & {
  monthlyKm: number;
  annualKm: number;
  lastActivity: string;
};

export default function HomeClient({
  userId,
  profile,
  journeys,
}: {
  userId: string;
  profile: Profile | null;
  journeys: JourneyWithStats[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingJourney, setEditingJourney] = useState<Journey | null>(null);
  const [registerJourneyId, setRegisterJourneyId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sorted = useMemo(
    () => [...journeys].sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()),
    [journeys]
  );

  function refresh() {
    router.refresh();
  }

  function handleRegisterClick() {
    if (journeys.length === 0) return;
    if (journeys.length === 1) {
      setRegisterJourneyId(journeys[0].id);
    } else {
      setPickerOpen(true);
    }
  }

  const registerJourney = journeys.find((j) => j.id === registerJourneyId);

  return (
    <div className="px-6 py-8 max-w-md mx-auto pb-28">
      <div className="flex items-center gap-2.5 mb-6">
        {profile && (
          <Link href="/profile" className="shrink-0">
            <Avatar profile={profile} size={38} />
          </Link>
        )}
        <div className="font-display text-xl tracking-wide">PROMPT & PACE</div>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted font-bold">
            Bem-vindo de volta{profile?.name ? `, ${profile.name}` : ""}
          </div>
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
              <JourneyCardMenu journey={j} onEdit={() => setEditingJourney(j)} onDeleted={refresh} />
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

      {pickerOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-40" onClick={() => setPickerOpen(false)}>
          <div
            className="w-full max-w-md mx-auto bg-surface2 rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display text-2xl mb-4">Registrar em qual jornada?</div>
            {journeys.map((j) => (
              <button
                key={j.id}
                onClick={() => {
                  setPickerOpen(false);
                  setRegisterJourneyId(j.id);
                }}
                className="w-full text-left px-4 py-3 rounded-xl mb-2 font-bold text-sm"
                style={{ background: `${j.theme_a}22`, border: `1px solid ${j.theme_a}44` }}
              >
                {j.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {registerJourney && (
        <RegisterRunModal
          journeyId={registerJourney.id}
          userId={userId}
          themeA={registerJourney.theme_a}
          themeB={registerJourney.theme_b}
          onClose={() => setRegisterJourneyId(null)}
          onRegistered={refresh}
        />
      )}
    </div>
  );
}
