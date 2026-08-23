"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { decodePolyline } from "@/lib/polyline";

// Estilo escuro customizado do Google Maps, combinando com o tema do app
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0A0E22" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8890B5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0A0E22" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#1a1f3a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#171C3A" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0F1329" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a2f52" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#05070F" }] },
];

let optionsSet = false;
function ensureOptions() {
  if (optionsSet) return;
  setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "", v: "weekly" });
  optionsSet = true;
}

export default function RouteMap({ polyline }: { polyline: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      setError(true);
      return;
    }

    const points = decodePolyline(polyline);
    if (points.length < 2 || !containerRef.current) return;
    const el = containerRef.current;
    let cancelled = false;

    ensureOptions();

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(() => {
        if (cancelled) return;

        const path = points.map(([lat, lng]) => ({ lat, lng }));

        const map = new google.maps.Map(el, {
          styles: DARK_MAP_STYLE,
          disableDefaultUI: true,
          gestureHandling: "none",
          keyboardShortcuts: false,
          backgroundColor: "#0A0E22",
        });

        new google.maps.Polyline({
          path,
          strokeColor: "#29F1D6",
          strokeWeight: 4,
          strokeOpacity: 0.95,
          map,
        });

        new google.maps.Marker({
          position: path[0],
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#29F1D6",
            fillOpacity: 1,
            strokeColor: "#0A0E22",
            strokeWeight: 2,
          },
        });

        const bounds = new google.maps.LatLngBounds();
        path.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, 24);
      })
      .catch(() => setError(true));

    return () => {
      cancelled = true;
    };
  }, [polyline]);

  if (error) {
    return (
      <div
        className="w-full rounded-xl flex items-center justify-center text-xs text-center px-4"
        style={{ height: 180, background: "#0A0E22", color: "#8890B5" }}
      >
        Não consegui carregar o mapa agora.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden"
      style={{ height: 180, background: "#0A0E22" }}
    />
  );
}
