"use client";

import { useState, useMemo, useRef } from "react";
import { X, Camera, Sparkles, RefreshCw, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseTimeInput, fmtPace, fmtTime, resizeImageFile } from "@/lib/utils";

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
  const [mode, setMode] = useState<"manual" | "photo">("manual");
  const [km, setKm] = useState("");
  const [time, setTime] = useState("");
  const [bpm, setBpm] = useState("");
  const [calories, setCalories] = useState("");
  const [saving, setSaving] = useState(false);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scannedFields, setScannedFields] = useState<Set<string>>(new Set());
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const livePace = useMemo(() => {
    const kmValue = parseFloat(km.replace(",", "."));
    if (!kmValue || !time) return null;
    const timeSec = parseTimeInput(time);
    if (!timeSec) return null;
    return fmtPace(timeSec, kmValue);
  }, [km, time]);

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
      calories: calories ? parseInt(calories, 10) : null,
    });

    setSaving(false);
    onRegistered();
    onClose();
  }

  function fieldClass() {
    return "w-full bg-white/5 border rounded-xl px-4 py-3 text-base font-extrabold outline-none mt-2 mb-4";
  }

  function fieldStyle(field: string) {
    return scannedFields.has(field) ? { borderColor: themeA } : { borderColor: "rgba(255,255,255,0.1)" };
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-40">
      <div className="w-full max-w-md mx-auto bg-surface2 rounded-t-3xl p-6 max-h-[88vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="font-display text-2xl">Registrar corrida</div>
          <button onClick={onClose} className="text-muted">
            <X size={20} />
          </button>
        </div>

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
            <label className="text-xs font-bold text-muted uppercase tracking-wide">Distância (km)</label>
            <input
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="ex: 5.2"
              className={fieldClass()}
              style={fieldStyle("km")}
            />

            <label className="text-xs font-bold text-muted uppercase tracking-wide">Tempo (h:mm:ss ou mm:ss)</label>
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="ex: 28:30 ou 1:05:30"
              className={fieldClass()}
              style={fieldStyle("time")}
            />

            <label className="text-xs font-bold text-muted uppercase tracking-wide">Pace</label>
            <div className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-base font-extrabold text-muted mt-2 mb-4">
              {livePace ? `${livePace} /km` : "preenche km e tempo"}
            </div>

            <label className="text-xs font-bold text-muted uppercase tracking-wide">Batimentos médios (opcional)</label>
            <input
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              placeholder="ex: 150"
              className={fieldClass()}
              style={fieldStyle("bpm")}
            />

            <label className="text-xs font-bold text-muted uppercase tracking-wide">Calorias (opcional)</label>
            <input
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="ex: 320"
              inputMode="numeric"
              className={fieldClass().replace("mb-4", "mb-5")}
              style={fieldStyle("calories")}
            />

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-4 rounded-2xl font-extrabold text-sm text-bg"
              style={{ background: `linear-gradient(90deg, ${themeA}, ${themeB})`, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Salvando..." : "Confirmar corrida"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
