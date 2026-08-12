"use client";

import { useState, useMemo, useRef } from "react";
import { X, Camera, Sparkles, RefreshCw, Image as ImageIcon, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseTimeInput, fmtPace, fmtTime, resizeImageFile } from "@/lib/utils";

type JourneyOption = { id: string; title: string; theme_a: string; theme_b: string };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Aplica a data escolhida mas mantém a hora atual (só pra manter uma ordenação sensata entre
// corridas do mesmo dia) — evita problema de fuso construindo a data em componentes locais.
function buildCreatedAt(dateStr: string) {
  const now = new Date();
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
}

export default function RegisterRunModal({
  journeys,
  defaultJourneyIds,
  userId,
  onClose,
  onRegistered,
}: {
  journeys: JourneyOption[];
  defaultJourneyIds: string[];
  userId: string;
  onClose: () => void;
  onRegistered: (journeyIds: string[]) => void;
}) {
  const supabase = createClient();
  const [mode, setMode] = useState<"manual" | "photo">("manual");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(defaultJourneyIds));
  const [date, setDate] = useState(todayStr());
  const [km, setKm] = useState("");
  const [time, setTime] = useState("");
  const [bpm, setBpm] = useState("");
  const [calories, setCalories] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scannedFields, setScannedFields] = useState<Set<string>>(new Set());
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const primaryJourney = journeys.find((j) => selectedIds.has(j.id)) ?? journeys[0];
  const themeA = primaryJourney?.theme_a ?? "#29F1D6";
  const themeB = primaryJourney?.theme_b ?? "#8B5CF6";

  const livePace = useMemo(() => {
    const kmValue = parseFloat(km.replace(",", "."));
    if (!kmValue || !time) return null;
    const timeSec = parseTimeInput(time);
    if (!timeSec) return null;
    return fmtPace(timeSec, kmValue);
  }, [km, time]);

  function toggleJourney(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError("");
    setScannedFields(new Set());
    setScanning(true);

    try {
      const dataUrl = await resizeImageFile(file);
      setPhotoPreview(dataUrl);

      const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (!match) throw new Error("Formato de imagem inválido");
      const [, mediaType, base64] = match;

      const res = await fetch("/api/scan-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const data = await res.json();

      if (data.error) {
        setScanError(data.error);
      } else {
        const filled = new Set<string>();
        if (data.km) {
          setKm(String(data.km));
          filled.add("km");
        }
        if (data.time_sec) {
          setTime(fmtTime(data.time_sec));
          filled.add("time");
        }
        if (data.bpm) {
          setBpm(String(data.bpm));
          filled.add("bpm");
        }
        if (data.calories) {
          setCalories(String(data.calories));
          filled.add("calories");
        }
        setScannedFields(filled);
        if (filled.size === 0) {
          setScanError("Não consegui identificar nenhum dado nessa imagem. Preenche manual abaixo.");
        }
      }
    } catch (err) {
      const detail = err instanceof Error ? ` (${err.message})` : "";
      setScanError(`Não consegui ler essa imagem${detail}. Tenta outra foto ou preenche manual.`);
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit() {
    setError("");
    const kmValue = parseFloat(km.replace(",", "."));
    if (!kmValue || kmValue <= 0) return;

    const targetIds = Array.from(selectedIds);
    if (targetIds.length === 0) {
      setError("Escolhe pelo menos uma jornada pra registrar.");
      return;
    }

    setSaving(true);
    const timeSec = time ? parseTimeInput(time) : Math.round(kmValue * 330);
    const createdAt = buildCreatedAt(date);

    const results = await Promise.all(
      targetIds.map((journeyId) =>
        supabase.from("runs").insert({
          journey_id: journeyId,
          user_id: userId,
          km: kmValue,
          time_sec: timeSec,
          bpm: bpm ? parseInt(bpm, 10) : null,
          calories: calories ? parseInt(calories, 10) : null,
          created_at: createdAt,
        })
      )
    );

    setSaving(false);
    const failed = results.filter((r) => r.error);
    const succeededIds = targetIds.filter((_, i) => !results[i].error);

    if (failed.length > 0 && succeededIds.length === 0) {
      setError(failed[0].error?.message || "Não consegui registrar. Tenta de novo.");
      return;
    }

    onRegistered(succeededIds);
    if (failed.length > 0) {
      setError(`Registrado em ${succeededIds.length} de ${targetIds.length} jornada(s). Alguma falhou — tenta de novo nela.`);
      return;
    }
    onClose();
  }

  function fieldStyle(field: string) {
    return scannedFields.has(field) ? { borderColor: themeA } : { borderColor: "rgba(255,255,255,0.1)" };
  }

  const inputClass = "w-full bg-white/5 border rounded-xl px-3 py-3 text-sm font-extrabold outline-none mt-1.5";
  const labelClass = "text-[10px] font-bold text-muted uppercase tracking-wide";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-40">
      <div className="w-full max-w-md mx-auto bg-surface2 rounded-t-3xl p-6 max-h-[88vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="font-display text-2xl">Registrar corrida</div>
          <button onClick={onClose} className="text-muted">
            <X size={20} />
          </button>
        </div>

        {journeys.length > 1 && (
          <div className="mb-5">
            <label className="text-xs font-bold text-muted uppercase tracking-wide mb-2 block">
              Registrar em (pode marcar mais de uma)
            </label>
            <div className="flex flex-wrap gap-2">
              {journeys.map((j) => {
                const isSelected = selectedIds.has(j.id);
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
          </div>
        )}

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setMode("manual")}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{
              background: mode === "manual" ? "rgba(255,255,255,0.08)" : "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              color: mode === "manual" ? "#F4F6FF" : "#8890B5",
            }}
          >
            Manual
          </button>
          <button
            onClick={() => setMode("photo")}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
            style={{
              background: mode === "photo" ? `${themeA}22` : "transparent",
              border: mode === "photo" ? `1px solid ${themeA}` : "1px solid rgba(255,255,255,0.1)",
              color: mode === "photo" ? themeA : "#8890B5",
            }}
          >
            <Sparkles size={13} /> Por foto
          </button>
        </div>

        {mode === "photo" && (
          <div className="mb-5">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!photoPreview && (
              <div className="flex gap-2">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 py-8 rounded-2xl border border-dashed border-white/20 flex flex-col items-center gap-2 text-muted"
                >
                  <Camera size={22} />
                  <span className="text-sm font-bold">Tirar foto</span>
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 py-8 rounded-2xl border border-dashed border-white/20 flex flex-col items-center gap-2 text-muted"
                >
                  <ImageIcon size={22} />
                  <span className="text-sm font-bold">Da galeria</span>
                </button>
              </div>
            )}

            {photoPreview && (
              <div className="mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Foto da corrida" className="w-full max-h-48 object-cover rounded-2xl mb-2" />
                <button
                  onClick={() => {
                    setPhotoPreview(null);
                    setScanError("");
                    setScannedFields(new Set());
                    if (cameraInputRef.current) cameraInputRef.current.value = "";
                    if (galleryInputRef.current) galleryInputRef.current.value = "";
                  }}
                  className="text-xs text-muted font-bold flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Trocar foto
                </button>
              </div>
            )}

            {scanning && (
              <div className="text-sm text-muted font-semibold flex items-center gap-2 mb-2">
                <Sparkles size={14} className="animate-pulse" style={{ color: themeA }} />
                Lendo a imagem...
              </div>
            )}

            {scanError && <div className="text-sm text-red-400 font-semibold mb-2">{scanError}</div>}

            {scannedFields.size > 0 && (
              <div className="text-xs font-semibold mb-2" style={{ color: themeA }}>
                Preenchido pela IA — confere os campos abaixo antes de salvar.
              </div>
            )}
          </div>
        )}

        {(mode === "manual" || photoPreview) && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className={labelClass}>Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={todayStr()}
                  className={inputClass}
                  style={{ borderColor: "rgba(255,255,255,0.1)", colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className={labelClass}>Km</label>
                <input
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  placeholder="5.2"
                  inputMode="decimal"
                  className={inputClass}
                  style={fieldStyle("km")}
                />
              </div>

              <div>
                <label className={labelClass}>Tempo</label>
                <input
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="28:30"
                  className={inputClass}
                  style={fieldStyle("time")}
                />
              </div>
              <div>
                <label className={labelClass}>Pace</label>
                <div className={`${inputClass} bg-white/[0.03] border-white/5 text-muted`}>
                  {livePace ? `${livePace}/km` : "--:--"}
                </div>
              </div>

              <div>
                <label className={labelClass}>Bpm</label>
                <input
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                  placeholder="150"
                  inputMode="numeric"
                  className={inputClass}
                  style={fieldStyle("bpm")}
                />
              </div>
              <div>
                <label className={labelClass}>Kcal</label>
                <input
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  placeholder="320"
                  inputMode="numeric"
                  className={inputClass}
                  style={fieldStyle("calories")}
                />
              </div>
            </div>

            {error && <div className="text-xs text-red-400 font-semibold mb-3">{error}</div>}

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-4 rounded-2xl font-extrabold text-sm text-bg"
              style={{ background: `linear-gradient(90deg, ${themeA}, ${themeB})`, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Salvando..." : `Confirmar corrida${selectedIds.size > 1 ? ` (${selectedIds.size} jornadas)` : ""}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
