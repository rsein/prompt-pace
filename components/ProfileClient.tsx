"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Bell, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { enablePushNotifications, disablePushNotifications, getPushSubscription, isPushSupported } from "@/lib/push";
import ProfileAvatarUpload from "./ProfileAvatarUpload";
import WearablesCard from "./WearablesCard";
import type { Profile } from "@/lib/types";

const THEME_A = "#29F1D6";
const GENDER_OPTIONS: { v: NonNullable<Profile["gender"]>; l: string }[] = [
  { v: "masculino", l: "Masculino" },
  { v: "feminino", l: "Feminino" },
  { v: "prefiro_nao_dizer", l: "Prefiro não dizer" },
];

export default function ProfileClient({
  profile,
  userId,
  journeys,
}: {
  profile: Profile;
  userId: string;
  journeys: { id: string; title: string; theme_a: string }[];
}) {
  const supabase = createClient();
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [gender, setGender] = useState(profile.gender ?? null);
  const [genderSaving, setGenderSaving] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState("");
  const [syncJourneyId, setSyncJourneyId] = useState(journeys[0]?.id ?? "");

  useEffect(() => {
    if (!isPushSupported()) return;
    getPushSubscription().then((sub) => setPushOn(!!sub));
  }, []);

  async function togglePush() {
    setPushBusy(true);
    setPushMsg("");
    try {
      if (pushOn) {
        await disablePushNotifications(userId);
        setPushOn(false);
      } else {
        await enablePushNotifications(userId);
        setPushOn(true);
      }
    } catch (err: unknown) {
      setPushMsg(err instanceof Error ? err.message : "Não consegui ativar as notificações.");
    } finally {
      setPushBusy(false);
    }
  }

  const syncJourney = journeys.find((j) => j.id === syncJourneyId) ?? journeys[0];

  async function saveGender(v: NonNullable<Profile["gender"]>) {
    setGender(v);
    setGenderSaving(true);
    await supabase.from("profiles").update({ gender: v }).eq("id", profile.id);
    setGenderSaving(false);
  }

  return (
    <div className="max-w-md mx-auto pb-16 px-5 pt-6">
      <Link href="/home" className="flex items-center gap-1 text-sm font-bold text-muted mb-6 w-fit">
        <ChevronLeft size={16} /> Home
      </Link>

      <div className="flex items-center gap-3.5 mb-8">
        <ProfileAvatarUpload profile={{ ...profile, avatar_url: avatarUrl }} onUpdated={setAvatarUrl} />
        <div>
          <div className="font-display text-2xl">{profile.name}</div>
          <div className="text-xs text-muted font-semibold">Seu perfil</div>
        </div>
      </div>

      <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5">
        Gênero <span className="normal-case font-semibold text-[10px]">(ajuda a IA a acertar seu rosto no pôster)</span>
      </div>
      <div className="flex gap-2 mb-6">
        {GENDER_OPTIONS.map((opt) => (
          <button
            key={opt.v}
            onClick={() => saveGender(opt.v)}
            disabled={genderSaving}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold border"
            style={{
              background: gender === opt.v ? "rgba(41,241,214,0.15)" : "transparent",
              borderColor: gender === opt.v ? THEME_A : "rgba(255,255,255,0.1)",
              color: gender === opt.v ? THEME_A : "#8890B5",
            }}
          >
            {opt.l}
          </button>
        ))}
      </div>

      <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5">Notificações</div>
      <div className="bg-surface rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {pushOn ? <Bell size={16} color={THEME_A} /> : <BellOff size={16} className="text-muted" />}
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
              background: pushOn ? "rgba(255,255,255,0.08)" : `${THEME_A}33`,
              color: pushOn ? "#8890B5" : THEME_A,
            }}
          >
            {pushBusy ? "..." : pushOn ? "Desativar" : "Ativar"}
          </button>
        </div>
        {pushMsg && <div className="text-[11px] text-red-400 font-semibold mt-2">{pushMsg}</div>}
        {!isPushSupported() && (
          <div className="text-[11px] text-muted mt-2">
            No iPhone, adiciona o Prompt & Pace à Tela de Início (Compartilhar → Adicionar à Tela de Início) pra
            notificações funcionarem.
          </div>
        )}
      </div>

      <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5">Sincronizar corridas</div>

      {journeys.length === 0 && (
        <div className="text-sm text-muted bg-surface rounded-2xl p-4">
          Entra numa jornada primeiro pra poder sincronizar corridas pra ela.
        </div>
      )}

      {journeys.length > 1 && (
        <select
          value={syncJourneyId}
          onChange={(e) => setSyncJourneyId(e.target.value)}
          className="w-full bg-surface rounded-xl px-3.5 py-2.5 text-sm font-semibold mb-2.5 border border-white/10"
        >
          {journeys.map((j) => (
            <option key={j.id} value={j.id}>
              Sincronizar pra: {j.title}
            </option>
          ))}
        </select>
      )}

      {syncJourney && (
        <Suspense fallback={null}>
          <WearablesCard journeyId={syncJourney.id} themeA={syncJourney.theme_a || THEME_A} onSynced={() => {}} />
        </Suspense>
      )}
    </div>
  );
}
