"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Journey } from "@/lib/types";

const THEME_PRESETS = [
  { a: "#29F1D6", b: "#8B5CF6" },
  { a: "#FFC145", b: "#FF5C8A" },
  { a: "#5CFF8F", b: "#29A8F1" },
  { a: "#FF7A5C", b: "#8B5CF6" },
];

export default function JourneyFormModal({
  userId,
  journey,
  onClose,
  onSaved,
}: {
  userId: string;
  journey?: Journey;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const isEdit = !!journey;

  const [title, setTitle] = useState(journey?.title ?? "");
  const [monthly, setMonthly] = useState(journey?.period_monthly ?? true);
  const [annual, setAnnual] = useState(journey?.period_annual ?? false);
  const [monthlyGoal, setMonthlyGoal] = useState(journey?.monthly_goal_km ? String(journey.monthly_goal_km) : "");
  const [annualGoal, setAnnualGoal] = useState(journey?.annual_goal_km ? String(journey.annual_goal_km) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    if (!title.trim()) {
      setError("Dá um nome pra jornada.");
      return;
    }
    if (!monthly && !annual) {
      setError("Escolhe pelo menos um período: mensal ou anual.");
      return;
    }
    if (monthly && !monthlyGoal) {
      setError("Define a meta mensal (em km).");
      return;
    }
    if (annual && !annualGoal) {
      setError("Define a meta anual (em km).");
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      season: monthly && !annual ? "Mensal" : annual && !monthly ? "Anual" : "Mensal + Anual",
      period_monthly: monthly,
      period_annual: annual,
      monthly_goal_km: monthly ? parseFloat(monthlyGoal.replace(",", ".")) : null,
      annual_goal_km: annual ? parseFloat(annualGoal.replace(",", ".")) : null,
    };

    if (isEdit) {
      const { error: err } = await supabase.from("journeys").update(payload).eq("id", journey!.id);
      if (err) {
        setError("Não consegui salvar. Tenta de novo.");
        setSaving(false);
        return;
      }
    } else {
      const preset = THEME_PRESETS[Math.floor(Math.random() * THEME_PRESETS.length)];
      const { data, error: err } = await supabase
        .from("journeys")
        .insert({ ...payload, theme_a: preset.a, theme_b: preset.b, created_by: userId })
        .select()
        .single();

      if (err || !data) {
        setError("Não consegui criar. Tenta de novo.");
        setSaving(false);
        return;
      }

      await supabase.from("journey_members").insert({ journey_id: data.id, user_id: userId });
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-40">
      <div className="w-full max-w-md mx-auto bg-surface2 rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div className="font-display text-2xl">{isEdit ? "Editar jornada" : "Nova jornada"}</div>
          <button onClick={onClose} className="text-muted">
            <X size={20} />
          </button>
        </div>

        <label className="text-xs font-bold text-muted uppercase tracking-wide">Nome</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ex: Prompt & Pace"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-extrabold outline-none mt-2 mb-4"
        />

        <label className="text-xs font-bold text-muted uppercase tracking-wide">Período</label>
        <div className="flex gap-2 mt-2 mb-4">
          <button
            type="button"
            onClick={() => setMonthly((v) => !v)}
            className="flex-1 py-3 rounded-xl text-sm font-bold border"
            style={{
              background: monthly ? "#29F1D633" : "rgba(255,255,255,0.05)",
              borderColor: monthly ? "#29F1D6" : "transparent",
              color: monthly ? "#29F1D6" : "#F4F6FF",
            }}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setAnnual((v) => !v)}
            className="flex-1 py-3 rounded-xl text-sm font-bold border"
            style={{
              background: annual ? "#8B5CF633" : "rgba(255,255,255,0.05)",
              borderColor: annual ? "#8B5CF6" : "transparent",
              color: annual ? "#8B5CF6" : "#F4F6FF",
            }}
          >
            Anual
          </button>
        </div>
        <div className="text-[11px] text-muted mb-4 leading-relaxed">
          A meta mensal zera todo mês (sem perder o histórico). Se marcar os dois, a jornada mostra os dois rankings.
        </div>

        {monthly && (
          <>
            <label className="text-xs font-bold text-muted uppercase tracking-wide">Meta mensal (km)</label>
            <input
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value)}
              placeholder="ex: 200"
              inputMode="decimal"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-extrabold outline-none mt-2 mb-4"
            />
          </>
        )}

        {annual && (
          <>
            <label className="text-xs font-bold text-muted uppercase tracking-wide">Meta anual (km)</label>
            <input
              value={annualGoal}
              onChange={(e) => setAnnualGoal(e.target.value)}
              placeholder="ex: 1500"
              inputMode="decimal"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-extrabold outline-none mt-2 mb-4"
            />
          </>
        )}

        {error && <div className="text-sm text-red-400 font-semibold mb-4">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-4 rounded-2xl font-extrabold text-sm text-bg bg-gradient-to-r from-[#29F1D6] to-[#8B5CF6]"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar jornada"}
        </button>
      </div>
    </div>
  );
}
