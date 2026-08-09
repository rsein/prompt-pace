"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Bell, BellOff, Save, CheckCircle2 } from "lucide-react";
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

const ETHNICITY_OPTIONS = ["Branca", "Preta", "Parda", "Amarela", "Indígena", "Prefiro não dizer"];

function bmiInfo(heightCm: number | null | undefined, weightKg: number | null | undefined) {
  if (!heightCm || !weightKg) return null;
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  let label = "";
  if (bmi < 18.5) label = "Abaixo do peso";
  else if (bmi < 25) label = "Peso adequado";
  else if (bmi < 30) label = "Sobrepeso";
  else if (bmi < 35) label = "Obesidade grau I";
  else if (bmi < 40) label = "Obesidade grau II";
  else label = "Obesidade grau III";
  return { value: bmi.toFixed(1), label };
}

export default function ProfileClient({
  profile,
  userId,
  email,
  journeys,
}: {
  profile: Profile;
  userId: string;
  email: string;
  journeys: { id: string; title: string; theme_a: string }[];
}) {
  const supabase = createClient();
  const router = useRouter();

  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [gender, setGender] = useState(profile.gender ?? null);
  const [heightCm, setHeightCm] = useState(profile.height_cm ? String(profile.height_cm) : "");
  const [weightKg, setWeightKg] = useState(profile.weight_kg ? String(profile.weight_kg) : "");
  const [ethnicity, setEthnicity] = useState(profile.ethnicity ?? "");
  const [age, setAge] = useState(profile.age ? String(profile.age) : "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

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

  async function saveProfile(): Promise<boolean> {
    setSaving(true);
    setSaveMsg("");
    const { error } = await supabase
      .from("profiles")
      .update({
        gender,
        height_cm: heightCm ? parseFloat(heightCm.replace(",", ".")) : null,
        weight_kg: weightKg ? parseFloat(weightKg.replace(",", ".")) : null,
        ethnicity: ethnicity || null,
        age: age ? parseInt(age) : null,
        phone: phone || null,
      })
      .eq("id", profile.id);
    setSaving(false);

    if (error) {
      setSaveMsg(`Não consegui salvar: ${error.message}`);
      return false;
    }
    setSaveMsg("Salvo!");
    setTimeout(() => setSaveMsg(""), 2500);
    return true;
  }

  async function handleBackToHome() {
    await saveProfile();
    router.push("/home");
  }

  const bmi = bmiInfo(heightCm ? parseFloat(heightCm.replace(",", ".")) : null, weightKg ? parseFloat(weightKg.replace(",", ".")) : null);
  const syncJourney = journeys.find((j) => j.id === syncJourneyId) ?? journeys[0];

  return (
    <div className="max-w-md mx-auto pb-24 px-5 pt-6">
      <button onClick={handleBackToHome} className="flex items-center gap-1 text-sm font-bold text-muted mb-6 w-fit">
        <ChevronLeft size={16} /> Home
      </button>

      <div className="flex items-center gap-3.5 mb-8">
        <ProfileAvatarUpload profile={{ ...profile, avatar_url: avatarUrl }} onUpdated={setAvatarUrl} />
        <div>
          <div className="font-display text-2xl">{profile.name}</div>
          <div className="text-xs text-muted font-semibold">{email}</div>
        </div>
      </div>

      <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2.5">Sobre você</div>
      <div className="bg-surface rounded-2xl p-4 mb-6 space-y-3.5">
        <div>
          <label className="text-xs text-muted font-bold mb-1.5 block">Gênero</label>
          <div className="flex gap-2">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.v}
                onClick={() => setGender(opt.v)}
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
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="text-xs text-muted font-bold mb-1.5 block">Idade</label>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              inputMode="numeric"
              placeholder="anos"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted font-bold mb-1.5 block">Altura</label>
            <input
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              inputMode="decimal"
              placeholder="cm"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted font-bold mb-1.5 block">Peso</label>
            <input
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              inputMode="decimal"
              placeholder="kg"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
            />
          </div>
        </div>

        {bmi && (
          <div className="bg-white/5 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-muted font-bold">IMC (Índice de Massa Corporal)</div>
              <div className="text-[10px] text-muted mt-0.5">Segundo a classificação da OMS — não substitui avaliação médica</div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="text-lg font-extrabold">{bmi.value}</div>
              <div className="text-[11px] font-bold" style={{ color: THEME_A }}>{bmi.label}</div>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-muted font-bold mb-1.5 block">Etnia</label>
          <select
            value={ethnicity}
            onChange={(e) => setEthnicity(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none"
          >
            <option value="">Não informado</option>
            {ETHNICITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted font-bold mb-1.5 block">Telefone (opcional)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none"
          />
        </div>
      </div>

      <button
        onClick={saveProfile}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm text-bg mb-2"
        style={{ background: `linear-gradient(90deg, #29F1D6, #8B5CF6)`, opacity: saving ? 0.7 : 1 }}
      >
        <Save size={16} /> {saving ? "Salvando..." : "Salvar alterações"}
      </button>
      {saveMsg && (
        <div className="flex items-center gap-1.5 text-xs font-semibold mb-6 justify-center" style={{ color: saveMsg.startsWith("Não") ? "#f87171" : "#5CFF8F" }}>
          {!saveMsg.startsWith("Não") && <CheckCircle2 size={13} />} {saveMsg}
        </div>
      )}
      {!saveMsg && <div className="mb-6" />}

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
