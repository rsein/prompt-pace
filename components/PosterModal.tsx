"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Download, Share2, RefreshCw } from "lucide-react";
import type { Journey, MemberTotal } from "@/lib/types";

const LOADING_MESSAGES = [
  "Aquecendo os personagens...",
  "Desenhando a poeira da pista...",
  "Ajustando a cara de cansaço do pelotão...",
  "Pintando o cenário da corrida...",
  "Dando os retoques finais no pôster...",
];

export default function PosterModal({
  journey,
  memberTotals,
  onClose,
}: {
  journey: Journey;
  memberTotals: MemberTotal[];
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function generate() {
    setLoading(true);
    setError("");
    setImageUrl(null);
    let i = 0;
    intervalRef.current = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 2200);

    try {
      const res = await fetch("/api/generate-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyId: journey.id,
          themeA: journey.theme_a,
          themeB: journey.theme_b,
          ranking: memberTotals.slice(0, 3).map((m) => ({
            id: m.id,
            name: m.name,
            avatar_url: m.avatar_url,
            color: m.color,
            km: m.km,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Não consegui gerar a imagem agora.");
      } else {
        setImageUrl(data.url);
      }
    } catch {
      setError("Não consegui gerar a imagem agora. Confere sua conexão e tenta de novo.");
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setLoading(false);
    }
  }

  useEffect(() => {
    generate();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShare() {
    if (!imageUrl) return;
    setSharing(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], `${journey.title}-ranking.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${journey.title} — ranking`,
          text: `Como tá o ranking da jornada "${journey.title}" 👀🏃`,
        });
      } else if (navigator.share) {
        await navigator.share({ title: journey.title, url: imageUrl });
      } else {
        window.open(imageUrl, "_blank");
      }
    } catch {
      // usuário cancelou o share ou o navegador bloqueou — sem problema, sem toast de erro
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="w-full max-w-md mx-auto bg-surface2 rounded-t-3xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="font-display text-2xl flex items-center gap-2">
            <Sparkles size={18} color={journey.theme_a} /> Imagem do ranking
          </div>
          <button onClick={onClose} className="text-muted">
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className="w-10 h-10 rounded-full border-2 border-transparent animate-spin"
              style={{ borderTopColor: journey.theme_a, borderRightColor: journey.theme_b }}
            />
            <div className="text-sm text-muted font-semibold text-center">{loadingMsg}</div>
          </div>
        )}

        {!loading && error && (
          <div className="py-6">
            <div className="text-sm text-red-400 font-semibold mb-4 text-center">{error}</div>
            <button
              onClick={generate}
              className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-bg"
              style={{ background: `linear-gradient(90deg, ${journey.theme_a}, ${journey.theme_b})` }}
            >
              Tentar de novo
            </button>
          </div>
        )}

        {!loading && imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={`Ranking de ${journey.title}`} className="w-full rounded-2xl mb-4" />

            <div className="flex gap-2 mb-2.5">
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm text-bg"
                style={{ background: `linear-gradient(90deg, ${journey.theme_a}, ${journey.theme_b})`, opacity: sharing ? 0.7 : 1 }}
              >
                <Share2 size={16} /> Compartilhar
              </button>
              <a
                href={imageUrl}
                download={`${journey.title}-ranking.png`}
                className="w-14 flex items-center justify-center rounded-2xl"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <Download size={17} />
              </a>
            </div>

            <button
              onClick={generate}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-muted"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <RefreshCw size={13} /> Gerar outra variação
            </button>
          </>
        )}
      </div>
    </div>
  );
}
