// O app é pensado pro fuso do Brasil (UTC-3, sem horário de verão atualmente), mas o servidor
// (Vercel) roda em UTC. Sem isso, "hoje"/"este mês" mudariam ~3h antes da hora certa pra quem
// usa o app no Brasil — e pior, cada pessoa da jornada veria um "mês" diferente se estivesse
// viajando em outro fuso. Ancorar tudo aqui garante que o corte do mês é o mesmo pra todo mundo.
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;

export function brazilParts(isoOrNothing?: string) {
  const ts = isoOrNothing ? new Date(isoOrNothing).getTime() : Date.now();
  const shifted = new Date(ts - BRAZIL_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0-11
    date: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

export function periodProgress(periodType: "monthly" | "annual") {
  const now = brazilParts();
  if (periodType === "monthly") {
    const totalDays = new Date(Date.UTC(now.year, now.month + 1, 0)).getUTCDate();
    const elapsedDays = now.date;
    return {
      pct: Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
      daysLeft: Math.max(0, totalDays - elapsedDays),
    };
  }
  const start = Date.UTC(now.year, 0, 1);
  const end = Date.UTC(now.year, 11, 31);
  const nowMs = Date.UTC(now.year, now.month, now.date);
  const totalDays = Math.round((end - start) / 86400000) + 1;
  const elapsedDays = Math.round((nowMs - start) / 86400000) + 1;
  return {
    pct: Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
    daysLeft: Math.max(0, totalDays - elapsedDays),
  };
}

// Cor da barra de progresso conforme o ritmo: verde quando está em dia ou à frente do calendário,
// e vai clareando pro amarelo até vermelho conforme o atraso aumenta (até um teto de 40 pontos).
// Usado tanto na Home (cards) quanto dentro da jornada.
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
function lerpColor(c1: string, c2: string, t: number) {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
export function paceColor(kmPct: number, timePct: number): string {
  const diff = kmPct - timePct;
  if (diff >= 0) return "#5CFF8F"; // verde — em dia ou à frente do calendário
  const behind = Math.min(Math.abs(diff), 40);
  return lerpColor("#FFC145", "#FF4D4D", behind / 40); // amarelo -> vermelho conforme o atraso cresce
}
export function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

export function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

// Redimensiona uma imagem no navegador antes de subir/enviar (evita fotos gigantes de celular).
// Retorna uma data URL "data:image/jpeg;base64,...".
export function resizeImageFile(file: File, maxDimension = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas não suportado"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não consegui abrir essa imagem"));
    };
    img.src = objectUrl;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.+);base64/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function fmtPace(timeSec: number, km: number) {
  if (!km) return "--:--";
  const secPerKm = timeSec / km;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtTime(timeSec: number) {
  const h = Math.floor(timeSec / 3600);
  const m = Math.floor((timeSec % 3600) / 60);
  const s = Math.round(timeSec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function parseTimeInput(input: string) {
  const parts = input.split(":").map((v) => parseInt(v, 10) || 0);
  if (parts.length === 3) {
    const [hh, mm, ss] = parts;
    return hh * 3600 + mm * 60 + ss;
  }
  const [mm, ss] = parts.length === 2 ? parts : [0, parts[0] || 0];
  return mm * 60 + (ss || 0);
}

export function isThisMonth(dateStr: string) {
  const d = brazilParts(dateStr);
  const now = brazilParts();
  return d.year === now.year && d.month === now.month;
}

export function isThisYear(dateStr: string) {
  return brazilParts(dateStr).year === brazilParts().year;
}

export function currentMonthLabel() {
  const now = brazilParts();
  return new Date(Date.UTC(now.year, now.month, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function currentYearLabel() {
  return String(brazilParts().year);
}
