"use client";

import { useState } from "react";
import { X, Trash2, Save, Check, CornerDownRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseTimeInput, fmtTime } from "@/lib/utils";
import StravaTag from "./StravaTag";

type PersonalRun = { km: number; time_sec: number; created_at: string; source: "strava" | "manual"; key: string };
type JourneyOption = { id: string; title: string; theme_a: string; theme_b: string };

export default function PersonalRunModal({
  run,
  userId,
  journeys,
  onClose,
  onSaved,
  onDeleted,
}: {
  run: PersonalRun;
  userId: string;
  journeys: JourneyOption[];
  onClose: () => void;
  onSaved: (updated: { km: number; time_sec: number }) => void;
  onDeleted: () => void;
}) {
  const supabase = createClient();
  const [km, setKm] = useState(String(run.km));
  const [time, setTime] = useState(fmtTime(run.time_sec));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedJourneys, setSelectedJourneys] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState("");

  function toggleJourney(id: string) {
    setSelectedJourneys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setError("");
    const kmValue = parseFloat(km.replace(",", "."));
    const timeSec = parseTimeInput(time);
    if (!kmValue || kmValue <= 0 || !timeSec || timeSec <= 0) {
      setError("Confere a distância e o tempo.");
      return;
    }

    setSaving(true);
    const table = run.source === "strava" ? "strava_history" : "runs";
    const idColumn = run.source === "strava" ? "external_id" : "id";
    const { error: err } = await supabase
      .from(table)
      .update({ km: kmValue, time_sec: timeSec })
      .eq(idColumn, run.key);

    setSaving(false);
    if (err) {
      setError(err.message || "Não consegui salvar.");
      return;
    }
    onSaved({ km: kmValue, time_sec: timeSec });
  }

  async function handleDelete() {
    setDeleting(true);
    const table = run.source === "strava" ? "strava_history" : "runs";
    const idColumn = run.source === "strava" ? "external_id" : "id";
    const { error: err } = await supabase.from(table).delete().eq(idColumn, run.key);
    setDeleting(false);
    if (err) {
      setError(err.message || "Não consegui excluir.");
      return;
    }
    onDeleted();
  }

  async function handleAddToJourneys() {
    if (selectedJourneys.size === 0) return;
    setAdding(true);
    setAddResult("");

    const rows = Array.from(selectedJourneys).map((journeyId) => ({
      journey_id: journeyId,
      user_id: userId,
      km: run.km,
      time_sec: run.time_sec,
      created_at: run.created_at,
      source: run.source,
      external_id: run.source === "strava" ? run.key : null,
    }));

    const { error: err } =
      run.source === "strava"
        ? await supabase.from("runs").upsert(rows, { onConflict: "journey_id,source,external_id", ignoreDuplicates: true })
        : await supabase.from("runs").insert(rows);

    setAdding(false);
    if (err) {
      setAddResult(err.message || "Não consegui adicionar.");
      return;
    }
    setAddResult(`Adicionada em ${selectedJourneys.size} jornada(s)!`);
    setSelectedJourneys(new Set());
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-40">
      <div className="w-full max-w-md mx-auto bg-surface2 rounded-t-3xl p-6 max-h-[88vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div className="font-display text-2xl flex items-center gap-2">
            Corrida {run.source === "strava" && <StravaTag />}
          </div>
          <button onClick={onClose} className="text-muted">
            <X size={20} />
          </button>
        </div>

        {!confirmingDelete ? (
          <>
            <div className="space-y-3 mb-4">
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                />
              </div>
            </div>

            {error && <div className="text-xs text-red-400 font-semibold mb-3">{error}</div>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm text-bg mb-2.5"
              style={{ background: "linear-gradient(90deg, #29F1D6, #8B5CF6)", opacity: saving ? 0.7 : 1 }}
            >
              <Save size={16} /> {saving ? "Salvando..." : "Salvar alterações"}
            </button>

            {journeys.length > 0 && (
              <>
                <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2 mt-5 flex items-center gap-1.5">
                  <CornerDownRight size={13} /> Adicionar a uma jornada
                </div>
                <div className="flex flex-wrap gap-2 mb-2.5">
                  {journeys.map((j) => {
                    const isSelected = selectedJourneys.has(j.id);
                    return (
                      <button
                        key={j.id}
                        onClick={() => toggleJourney(j.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border"
                        style={{
                          background: isSelected ? `${j.theme_a}22` : "transparent",
                          borderColor: isSelected ? j.theme_a : "rgba(255,255,255,0.12)",
                          color: isSelected ? j.theme_a : "#8890B5",
                        }}
                      >
                        {isSelected && <Check size={12} />} {j.title}
                      </button>
                    );
                  })}
                </div>
                {addResult && <div className="text-xs font-semibold mb-2" style={{ color: "#5CFF8F" }}>{addResult}</div>}
                <button
                  onClick={handleAddToJourneys}
                  disabled={adding || selectedJourneys.size === 0}
                  className="w-full py-3 rounded-xl text-sm font-bold mb-2.5"
                  style={{ border: "1px solid rgba(255,255,255,0.12)", opacity: selectedJourneys.size === 0 ? 0.5 : 1 }}
                >
                  {adding ? "Adicionando..." : "Adicionar"}
                </button>
              </>
            )}

            <button
              onClick={() => setConfirmingDelete(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-red-400 mt-2"
              style={{ border: "1px solid rgba(248,113,113,0.3)" }}
            >
              <Trash2 size={15} /> Excluir do histórico pessoal
            </button>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-sm font-semibold mb-5">
              Excluir essa corrida do seu histórico pessoal? Isso não mexe em jornadas onde ela já foi adicionada.
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
