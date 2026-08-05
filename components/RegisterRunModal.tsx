"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseTimeInput } from "@/lib/utils";

export default function RegisterRunModal({
  journeyId,
  userId,
  themeA,
  themeB,
  onClose,
  onRegistered,
}: {
  journeyId: string;
  userId: string;
  themeA: string;
  themeB: string;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const supabase = createClient();
  const [km, setKm] = useState("");
  const [time, setTime] = useState("");
  const [bpm, setBpm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const kmValue = parseFloat(km.replace(",", "."));
    if (!kmValue || kmValue <= 0) return;
    setSaving(true);

    const timeSec = time ? parseTimeInput(time) : Math.round(kmValue * 330);

    await supabase.from("runs").insert({
      journey_id: journeyId,
      user_id: userId,
      km: kmValue,
      time_sec: timeSec,
      bpm: bpm ? parseInt(bpm, 10) : null,
    });

    setSaving(false);
    onRegistered();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-40">
      <div className="w-full bg-surface2 rounded-t-3xl p-6">
        <div className="flex justify-between items-center mb-5">
          <div className="font-display text-2xl">Registrar corrida</div>
          <button onClick={onClose} className="text-muted">
            <X size={20} />
          </button>
        </div>

        <label className="text-xs font-bold text-muted uppercase tracking-wide">Distância (km)</label>
        <input
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="ex: 5.2"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-extrabold outline-none mt-2 mb-4"
        />

        <label className="text-xs font-bold text-muted uppercase tracking-wide">Tempo (mm:ss)</label>
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="ex: 28:30"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-extrabold outline-none mt-2 mb-4"
        />

        <label className="text-xs font-bold text-muted uppercase tracking-wide">Batimentos médios (opcional)</label>
        <input
          value={bpm}
          onChange={(e) => setBpm(e.target.value)}
          placeholder="ex: 150"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-extrabold outline-none mt-2 mb-5"
        />

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-4 rounded-2xl font-extrabold text-sm text-bg"
          style={{ background: `linear-gradient(90deg, ${themeA}, ${themeB})`, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Salvando..." : "Confirmar corrida"}
        </button>
      </div>
    </div>
  );
}
