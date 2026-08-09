"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Download, Share2, RefreshCw } from "lucide-react";
import type { Journey, MemberTotal } from "@/lib/types";

const LOADING_MESSAGES = [
  "Aquecendo os personagens...",
  "Desenhando a poeira da pista...",
  "Ajustando a cara de cansaço do pelotão...",
  "Pintando o cenário da corrida...",
  "Montando o placar do ranking...",
];

const MEDAL_COLORS = ["#FFC145", "#C7CEDD", "#CD8A5A"];
const SLOGAN = "Prompt rápido. Pace nem tanto.";

export default function PosterModal({
  journey,
  memberTotals,
  narratorComment,
  onClose,
}: {
  journey: Journey;
  memberTotals: MemberTotal[];
  narratorComment?: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Desenha a logo do app no topo e o placar do ranking no rodapé, por cima da ilustração gerada pela IA —
  // e monta tudo já no formato Stories do Instagram (9:16), pra ficar prontinho pra postar.
  async function composite(imageUrl: string): Promise<Blob> {
    try {
      await document.fonts.load('700 60px "Bebas Neue"');
      await document.fonts.load('800 40px "Manrope"');
    } catch {
      // segue mesmo se a fonte não carregar a tempo — cai na fonte padrão do sistema
    }

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Falha ao carregar a imagem base"));
      el.src = imageUrl;
    });

    const w = img.naturalWidth;
    const imgH = img.naturalHeight;
    const rows = memberTotals.slice(0, 5);

    // Tamanhos-base das faixas: topo só com o título da jornada, rodapé com o placar,
    // e uma faixinha final com a marca "Prompt & Pace" + slogan (só aparece uma vez, aqui embaixo).
    let topBarH = Math.round(w * 0.095);
    const rowH = Math.round(w * 0.072);
    const rowsPad = Math.round(w * 0.045);
    let scoreBarH = Math.round(rows.length * rowH + rowsPad * 1.8);
    const footerBarH = Math.round(w * 0.115);

    // Estica topo e placar (não a arte, nem o rodapé da marca) até fechar em 9:16 — formato de Stories
    const targetH = Math.round(w * (16 / 9));
    const extra = targetH - (topBarH + imgH + scoreBarH + footerBarH);
    if (extra > 0) {
      topBarH += Math.round(extra * 0.3);
      scoreBarH += Math.round(extra * 0.7);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = topBarH + imgH + scoreBarH + footerBarH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não suportado");

    // Fundo geral (cobre qualquer respiro extra com o degradê do tema, nunca fica em branco)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, journey.theme_a);
    bgGrad.addColorStop(1, journey.theme_b);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ilustração da IA
    ctx.drawImage(img, 0, topBarH, w, imgH);

    // Faixa do topo — só o nome da jornada
    const topGrad = ctx.createLinearGradient(0, 0, w, 0);
    topGrad.addColorStop(0, `${journey.theme_a}F2`);
    topGrad.addColorStop(1, `${journey.theme_b}F2`);
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, w, topBarH);

    ctx.textAlign = "center";
    ctx.fillStyle = "#05070F";
    ctx.font = `700 ${Math.round(w * 0.055)}px "Bebas Neue", sans-serif`;
    ctx.fillText(journey.title.toUpperCase(), w / 2, topBarH * 0.65);

    // Faixa do placar — ranking atual, centralizado verticalmente no espaço disponível
    const scoreY = topBarH + imgH;
    ctx.fillStyle = "rgba(5, 7, 15, 0.92)";
    ctx.fillRect(0, scoreY, w, scoreBarH);

    const contentH = rows.length * rowH;
    const startY = scoreY + (scoreBarH - contentH) / 2;
    const pad = Math.round(w * 0.06);

    rows.forEach((m, i) => {
      const y = startY + i * rowH;
      const badgeR = rowH * 0.32;
      const badgeX = pad + badgeR;
      const badgeY = y + rowH * 0.34;

      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = MEDAL_COLORS[i] ?? `${m.color}77`;
      ctx.fill();

      ctx.fillStyle = "#05070F";
      ctx.textAlign = "center";
      ctx.font = `800 ${Math.round(badgeR * 1.15)}px "Manrope", sans-serif`;
      ctx.fillText(String(i + 1), badgeX, badgeY + badgeR * 0.36);

      ctx.textAlign = "left";
      ctx.fillStyle = "#F4F6FF";
      ctx.font = `800 ${Math.round(rowH * 0.32)}px "Manrope", sans-serif`;
      ctx.fillText(m.name, pad + badgeR * 2 + Math.round(w * 0.03), badgeY + rowH * 0.1);

      ctx.textAlign = "right";
      ctx.fillStyle = journey.theme_a;
      ctx.font = `800 ${Math.round(rowH * 0.32)}px "Manrope", sans-serif`;
      ctx.fillText(`${m.km.toFixed(1)} km`, w - pad, badgeY + rowH * 0.1);
    });

    // Faixa final — a marca do app aparece só aqui, uma única vez
    const footerY = scoreY + scoreBarH;
    ctx.fillStyle = "#05070F";
    ctx.fillRect(0, footerY, w, footerBarH);

    ctx.textAlign = "center";
    ctx.fillStyle = journey.theme_a;
    ctx.font = `700 ${Math.round(w * 0.062)}px "Bebas Neue", sans-serif`;
    ctx.fillText("PROMPT & PACE", w / 2, footerY + footerBarH * 0.52);
    ctx.fillStyle = "#8890B5";
    ctx.font = `600 ${Math.round(w * 0.026)}px "Manrope", sans-serif`;
    ctx.fillText(SLOGAN, w / 2, footerY + footerBarH * 0.8);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Falha ao montar a imagem final"));
      }, "image/png");
    });
  }

  async function generate() {
    setLoading(true);
    setError("");
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    setPreviewUrl(null);
    setFinalBlob(null);
    setRawUrl(null);

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
          narratorComment: narratorComment || "",
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
        return;
      }

      setRawUrl(data.url);
      try {
        const blob = await composite(data.url);
        const objUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objUrl;
        setFinalBlob(blob);
        setPreviewUrl(objUrl);
      } catch (compErr) {
        // se a composição falhar (ex: CORS), ainda mostra a imagem crua da IA
        console.error("Não consegui sobrepor a logo/placar:", compErr);
        setPreviewUrl(data.url);
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
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShare() {
    if (!previewUrl) return;
    setSharing(true);
    try {
      let file: File;
      if (finalBlob) {
        file = new File([finalBlob], `${journey.title}-ranking.png`, { type: "image/png" });
      } else {
        const res = await fetch(rawUrl ?? previewUrl);
        const blob = await res.blob();
        file = new File([blob], `${journey.title}-ranking.png`, { type: "image/png" });
      }

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${journey.title} — ranking`,
          text: `Como tá o ranking da jornada "${journey.title}" 👀🏃`,
        });
      } else if (navigator.share) {
        await navigator.share({ title: journey.title, text: "Confere o ranking da nossa jornada de corrida!" });
      } else {
        window.open(previewUrl, "_blank");
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

        {!loading && !error && previewUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={`Ranking de ${journey.title}`} className="w-full rounded-2xl mb-4" />

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
                href={previewUrl}
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
