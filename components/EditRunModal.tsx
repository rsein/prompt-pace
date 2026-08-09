"use client";

import { useState } from "react";
import { X, Trash2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseTimeInput, fmtTime } from "@/lib/utils";
import type { Run } from "@/lib/types";

export default function EditRunModal({
  run,
  themeA,
  themeB,
  onClose,
  onSaved,
  onDeleted,
}: {
  run: Run;
  themeA: string;
  themeB: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const supabase = createClient();
  const [km, setKm] = useState(String(run.km));
  const [time, setTime] = useState(fmtTime(run.time_sec));
  const [bpm, setBpm] = useState(run.bpm ? String(run.bpm) : "");
  const [calories, setCalories] = useState(run.calories ? String(run.calories) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setError("");
    const kmValue = parseFloat(km.replace(",", "."));
    const timeSec = parseTimeInput(time);

    if (!kmValue || kmValue <= 0) {
      setError("Coloca uma distância válida.");
      return;
    }
    if (!timeSec || timeSec <= 0) {
      setError("Coloca um tempo válido (mm:ss).");
      return;
    }

    setSaving(true);
    const { error: err } = await supabase
      .from("runs")
      .update({
        km: kmValue,
        time_sec: timeSec,
        bpm: bpm ? parseInt(bpm) : null,
        calories: calories ? parseInt(calories) : null,
      })
      .eq("id", run.id);

    setSaving(false);
    if (err) {
      setError(err.message || "Não consegui salvar. Tenta de novo.");
      return;
    }
    onSaved();
  }

  async function handleDelete() {
    setDeleting(true);
    const { error: err } = await supabase.from("runs").delete().eq("id", run.id);
    setDeleting(false);
    if (err) {
      setError(err.message || "Não consegui excluir. Tenta de novo.");
      return;
    }
    onDeleted();
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="w-full max-w-md mx-auto bg-surface2 rounded-t-3xl p-6">
        <div className="flex justify-between items-center mb-5">
          <div className="font-display text-2xl">Editar corrida</div>
          <button onClick={onClose} className="text-muted">
            <X size={20} />
          </button>
        </div>

        {!confirmingDelete ? (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted font-bold mb-1.5 block">Distância (km)</label>
                <input
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  inputMode="decimal"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted font-bold mb-1.5 block">Tempo (mm:ss ou h:mm:ss)</label>
                <input
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="ex: 32:15"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted font-bold mb-1.5 block">BPM (opcional)</label>
                  <input
                    value={bpm}
                    onChange={(e) => setBpm(e.target.value)}
                    inputMode="numeric"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted font-bold mb-1.5 block">Calorias (opcional)</label>
                  <input
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    inputMode="numeric"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                  />
                </div>
              </div>
            </div>

            {error && <div className="text-xs text-red-400 font-semibold mt-3">{error}</div>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm text-bg mt-5"
              style={{ background: `linear-gradient(90deg, ${themeA}, ${themeB})`, opacity: saving ? 0.7 : 1 }}
            >
              <Save size={16} /> {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-red-400 mt-2.5"
              style={{ border: "1px solid rgba(248,113,113,0.3)" }}
            >
              <Trash2 size={15} /> Excluir corrida
            </button>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-sm font-semibold mb-5">
              Tem certeza que quer excluir essa corrida? Essa ação não pode ser desfeita.
            </div>
            {error && <div className="text-xs text-red-400 font-semibold mb-3">{error}</div>}
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3.5 rounded-2xl font-extrabold text-sm text-white bg-red-500"
                style={{ opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
