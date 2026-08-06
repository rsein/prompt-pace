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
  const m = Math.floor(timeSec / 60);
  const s = Math.round(timeSec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function parseTimeInput(input: string) {
  const [mm, ss] = input.split(":").map((v) => parseInt(v, 10) || 0);
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
