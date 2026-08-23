"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { decodePolyline } from "@/lib/polyline";

export default function RouteMap({ polyline }: { polyline: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    const points = decodePolyline(polyline);
    if (points.length < 2 || !containerRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      // Se o componente re-renderizar com um traçado diferente, remove o mapa anterior antes de criar outro
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        attributionControl: true,
      });
      mapRef.current = map;

      // Tiles escuros do CartoDB (gratuitos, sem precisar de chave) — combina com o tema escuro do app
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const line = L.polyline(points, { color: "#29F1D6", weight: 4, lineCap: "round", lineJoin: "round" }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [20, 20] });

      L.circleMarker(points[0], { radius: 6, color: "#0A0E22", weight: 2, fillColor: "#29F1D6", fillOpacity: 1 }).addTo(map);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [polyline]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden"
      style={{ height: 180, background: "#0A0E22" }}
    />
  );
}
