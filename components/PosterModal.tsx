"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Download, Share2, RefreshCw } from "lucide-react";
import type { Journey, MemberTotal, Profile } from "@/lib/types";

const LOADING_MESSAGES = [
  "Aquecendo os personagens...",
  "Desenhando a poeira da pista...",
  "Ajustando a cara de cansaço do pelotão...",
  "Pintando o cenário da corrida...",
  "Montando o placar do ranking...",
];

const MEDAL_COLORS = ["#FFC145", "#C7CEDD", "#CD8A5A"];
const SLOGAN_PART1 = "Mais que corrida. ";
const SLOGAN_PART2 = "É conexão.";

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = src;
  });
}

export default function PosterModal({
  journey,
  memberTotals,
  allMembers,
  narratorComment,
  onClose,
}: {
  journey: Journey;
  memberTotals: MemberTotal[];
  allMembers: Profile[];
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

  // Desenha a logo (ícone + "PROMPT & PACE") no topo e um placar estiloso no rodapé, por cima da
  // ilustração gerada pela IA — a IA só cuida da cena de ação; números, nomes e fotos são sempre
  // desenhados por código, pra nunca sair errado. Formato final: Stories do Instagram (9:16).
  async function composite(imageUrl: string): Promise<Blob> {
    try {
      await document.fonts.load('700 60px "Bebas Neue"');
      await document.fonts.load('800 40px "Manrope"');
    } catch {
      // segue mesmo se a fonte não carregar a tempo — cai na fonte padrão do sistema
    }

    const [img, appIcon] = await Promise.all([
      new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new window.Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Falha ao carregar a imagem base"));
        el.src = imageUrl;
      }),
      loadImageSafe("/icons/icon-512.png"),
    ]);

    const rows = memberTotals.slice(0, 5);
    const avatarImgs = await Promise.all(rows.map((m) => (m.avatar_url ? loadImageSafe(m.avatar_url) : Promise.resolve(null))));

    const w = img.naturalWidth;
    const imgH = img.naturalHeight;

    const topBarH = Math.round(w * 0.13);
    const rowH = Math.round(w * 0.1);
    const cardPad = Math.round(w * 0.05);
    const innerPad = Math.round(w * 0.045);
    const cardH = Math.round(rows.length * rowH + innerPad * 1.4);
    const cardX = cardPad;
    const cardW = w - cardPad * 2;
    const footerTextH = Math.round(w * 0.075);

    let gapAboveCard = Math.round(cardPad * 0.7);
    let gapBelowFooter = Math.round(cardPad * 0.7);

    const naturalTotal = topBarH + imgH + gapAboveCard + cardH + footerTextH + gapBelowFooter;
    const targetH = Math.round(w * (16 / 9));
    const extra = targetH - naturalTotal;
    if (extra > 0) {
      gapAboveCard += Math.round(extra * 0.4);
      gapBelowFooter += Math.round(extra * 0.6);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = topBarH + imgH + gapAboveCard + cardH + footerTextH + gapBelowFooter;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não suportado");

    // Fundo geral — navy escuro (bate com a identidade do app, não o degradê da jornada)
    ctx.fillStyle = "#05070F";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ilustração da IA
    ctx.drawImage(img, 0, topBarH, w, imgH);

    // Faixa do topo — logo (ícone + PROMPT & PACE)
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(topBarH * 0.34)}px "Bebas Neue", sans-serif`;
    const promptW = ctx.measureText("PROMPT ").width;
    const ampW = ctx.measureText("& ").width;
    const paceW = ctx.measureText("PACE").width;
    const iconSize = topBarH * 0.5;
    const gap = iconSize * 0.28;
    const totalW = iconSize + gap + promptW + ampW + paceW;
    let cx = (w - totalW) / 2;
    const iconY = (topBarH - iconSize) / 2;

    if (appIcon) {
      ctx.save();
      roundRectPath(ctx, cx, iconY, iconSize, iconSize, iconSize * 0.26);
      ctx.clip();
      ctx.drawImage(appIcon, cx, iconY, iconSize, iconSize);
      ctx.restore();
    }
    cx += iconSize + gap;

    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("PROMPT ", cx, topBarH / 2);
    cx += promptW;
    ctx.fillText("& ", cx, topBarH / 2);
    cx += ampW;
    const paceGrad = ctx.createLinearGradient(cx, 0, cx + paceW, 0);
    paceGrad.addColorStop(0, "#29F1D6");
    paceGrad.addColorStop(1, "#8B5CF6");
    ctx.fillStyle = paceGrad;
    ctx.fillText("PACE", cx, topBarH / 2);

    // Cartão do placar
    const cardY = topBarH + imgH + gapAboveCard;
    ctx.save();
    ctx.shadowColor = `${journey.theme_a}55`;
    ctx.shadowBlur = cardPad * 0.7;
    roundRectPath(ctx, cardX, cardY, cardW, cardH, cardW * 0.05);
    ctx.fillStyle = "rgba(12, 16, 34, 0.92)";
    ctx.fill();
    ctx.restore();
    roundRectPath(ctx, cardX, cardY, cardW, cardH, cardW * 0.05);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const maxKm = Math.max(...rows.map((r) => r.km), 0.001);

    rows.forEach((m, i) => {
      const y = cardY + innerPad * 0.7 + i * rowH;
      const badgeR = rowH * 0.26;
      const badgeX = cardX + innerPad + badgeR;
      const rowMidY = y + rowH * 0.36;

      ctx.beginPath();
      ctx.arc(badgeX, rowMidY, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = MEDAL_COLORS[i] ?? `${m.color}77`;
      ctx.fill();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#05070F";
      ctx.font = `800 ${Math.round(badgeR * 1.05)}px "Manrope", sans-serif`;
      ctx.fillText(String(i + 1), badgeX, rowMidY + 1);

      const avR = rowH * 0.32;
      const avX = badgeX + badgeR + avR + innerPad * 0.35;
      ctx.save();
      ctx.beginPath();
      ctx.arc(avX, rowMidY, avR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const avImg = avatarImgs[i];
      if (avImg) {
        ctx.drawImage(avImg, avX - avR, rowMidY - avR, avR * 2, avR * 2);
      } else {
        ctx.fillStyle = m.color;
        ctx.fillRect(avX - avR, rowMidY - avR, avR * 2, avR * 2);
        ctx.fillStyle = "#05070F";
        ctx.font = `800 ${Math.round(avR)}px "Manrope", sans-serif`;
        ctx.fillText(m.name.slice(0, 2).toUpperCase(), avX, rowMidY + 1);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(avX, rowMidY, avR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const textX = avX + avR + innerPad * 0.5;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#F4F6FF";
      ctx.font = `800 ${Math.round(rowH * 0.24)}px "Manrope", sans-serif`;
      ctx.fillText(m.name, textX, y + rowH * 0.32);

      const barW = cardW * 0.32;
      const barH = Math.max(5, rowH * 0.09);
      const barY = y + rowH * 0.46;
      roundRectPath(ctx, textX, barY, barW, barH, barH / 2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fill();
      const fillW = Math.max(barH, barW * (m.km / maxKm));
      const barGrad = ctx.createLinearGradient(textX, 0, textX + fillW, 0);
      barGrad.addColorStop(0, journey.theme_a);
      barGrad.addColorStop(1, journey.theme_b);
      roundRectPath(ctx, textX, barY, fillW, barH, barH / 2);
      ctx.fillStyle = barGrad;
      ctx.fill();

      const rightX = cardX + cardW - innerPad;
      ctx.textAlign = "right";
      const kmGrad = ctx.createLinearGradient(rightX - cardW * 0.28, 0, rightX, 0);
      kmGrad.addColorStop(0, journey.theme_a);
      kmGrad.addColorStop(1, journey.theme_b);
      ctx.fillStyle = kmGrad;
      ctx.font = `800 ${Math.round(rowH * 0.3)}px "Manrope", sans-serif`;
      ctx.fillText(`${m.km.toFixed(1)} km`, rightX, y + rowH * 0.32);
      ctx.fillStyle = "#8890B5";
      ctx.font = `600 ${Math.round(rowH * 0.15)}px "Manrope", sans-serif`;
      ctx.fillText("Distância total", rightX, y + rowH * 0.5);
    });

    // Rodapé — slogan da marca
    const footerY = cardY + cardH + footerTextH * 0.62;
    ctx.font = `700 ${Math.round(w * 0.034)}px "Manrope", sans-serif`;
    const boltAndPart1 = "⚡ " + SLOGAN_PART1;
    const seg1W = ctx.measureText(boltAndPart1).width;
    const seg2W = ctx.measureText(SLOGAN_PART2).width;
    let fx = (w - (seg1W + seg2W)) / 2;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#F4F6FF";
    ctx.fillText(boltAndPart1, fx, footerY);
    fx += seg1W;
    ctx.fillStyle = journey.theme_a;
    ctx.fillText(SLOGAN_PART2, fx, footerY);

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
          allMemberNames: allMembers.map((m) => m.name),
          ranking: memberTotals.slice(0, 3).map((m) => ({
            id: m.id,
            name: m.name,
            avatar_url: m.avatar_url,
            color: m.color,
            gender: m.gender ?? null,
            ethnicity: m.ethnicity ?? null,
            age: m.age ?? null,
            height_cm: m.height_cm ?? null,
            weight_kg: m.weight_kg ?? null,
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
