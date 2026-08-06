export function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
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
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function isThisYear(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear();
}

export function currentMonthLabel() {
  const now = new Date();
  return now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function currentYearLabel() {
  return String(new Date().getFullYear());
}
