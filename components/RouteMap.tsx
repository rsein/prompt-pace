"use client";

import { decodePolyline } from "@/lib/polyline";

export default function RouteMap({ polyline }: { polyline: string }) {
  const points = decodePolyline(polyline);
  if (points.length < 2) return null;

  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const VB = 280;
  const PAD = 24;
  const latRange = maxLat - minLat || 0.0001;
  const lngRange = maxLng - minLng || 0.0001;
  const biggerRange = Math.max(latRange, lngRange);
  const scale = (VB - PAD * 2) / biggerRange;

  function toXY([lat, lng]: [number, number]) {
    const x = PAD + (lng - minLng) * scale + ((biggerRange - lngRange) * scale) / 2;
    const y = PAD + (maxLat - lat) * scale + ((biggerRange - latRange) * scale) / 2;
    return [x, y];
  }

  const pathD = points
    .map((p, i) => {
      const [x, y] = toXY(p);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const [startX, startY] = toXY(points[0]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ height: 180, background: "#0A0E22" }}>
      <svg className="absolute inset-0 w-full h-full opacity-[0.08]" preserveAspectRatio="none">
        <defs>
          <pattern id="routeGrid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M 26 0 L 0 0 0 26" fill="none" stroke="#ffffff" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#routeGrid)" />
      </svg>

      <svg viewBox={`0 0 ${VB} ${VB}`} className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#29F1D6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <path d={pathD} fill="none" stroke="url(#routeGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={startX} cy={startY} r="6" fill="#29F1D6" stroke="#0A0E22" strokeWidth="2" />
      </svg>
    </div>
  );
}
