"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, Link2, Unlink, CheckCircle2 } from "lucide-react";
import type { WearableStatus } from "@/lib/types";

const PROVIDER_LABEL: Record<string, string> = {
  strava: "Strava",
  garmin: "Garmin Connect",
  samsung: "Samsung Health",
};

export default function WearablesCard({
  journeyId,
  themeA,
  onSynced,
}: {
  journeyId: string;
  themeA: string;
  onSynced: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statuses, setStatuses] = useState<WearableStatus[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadStatus() {
    try {
      const res = await fetch("/api/wearables/status");
      const data = await res.json();
      if (data.statuses) setStatuses(data.statuses);
    } catch {
      // silencioso — o card só não mostra status por enquanto
    }
  }

  useEffect(() => {
    loadStatus();
    const stravaParam = searchParams.get("strava");
    if (stravaParam) {
      if (stravaParam === "connected") {
        setMsg("Strava conectado! Sincronizando suas últimas corridas...");
        handleSync(true);
      } else if (stravaParam === "denied") {
        setMsg("Conexão com o Strava cancelada.");
      } else if (stravaParam === "not_configured") {
        setMsg("A integração com o Strava ainda não foi configurada nesse app.");
      } else if (stravaParam === "error") {
        setMsg("Não consegui conectar com o Strava. Tenta de novo.");
      }
      router.replace(`/journey/${journeyId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSync(silent = false) {
    setSyncing(true);
    if (!silent) setMsg("");
    try {
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMsg(data.error || "Não consegui sincronizar agora.");
      } else {
        setMsg(data.imported > 0 ? `${data.imported} corrida(s) importada(s) do Strava.` : "Tudo certo — nenhuma corrida nova pra importar.");
        onSynced();
      }
      loadStatus();
    } catch {
      setMsg("Não consegui sincronizar agora. Tenta de novo.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setSyncing(true);
    try {
      await fetch("/api/strava/disconnect", { method: "POST" });
      setMsg("Strava desconectado.");
      loadStatus();
    } finally {
      setSyncing(false);
    }
  }

  const strava = statuses?.find((s) => s.provider === "strava");
  const garmin = statuses?.find((s) => s.provider === "garmin");
  const samsung = statuses?.find((s) => s.provider === "samsung");

  return (
    <div className="space-y-2.5">
      {/* Strava */}
      <div className="bg-surface rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
              style={{ background: "#FC520033", color: "#FC5200" }}
            >
              S
            </div>
            <div>
              <div className="text-sm font-bold">Strava</div>
              <div className="text-[11px] text-muted">
                {strava?.connected
                  ? strava.lastSyncedAt
                    ? `Última sincronização: ${new Date(strava.lastSyncedAt).toLocaleDateString("pt-BR")}`
                    : "Conectado — ainda não sincronizou"
                  : "Importa corridas automaticamente"}
              </div>
            </div>
          </div>

          {strava?.connected ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleSync(false)}
                disabled={syncing}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: `${themeA}22`, color: themeA }}
                title="Sincronizar agora"
              >
                <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              </button>
              <button
                onClick={handleDisconnect}
                disabled={syncing}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted"
                style={{ background: "rgba(255,255,255,0.06)" }}
                title="Desconectar"
              >
                <Unlink size={14} />
              </button>
            </div>
          ) : (
            <a
              href={`/api/strava/connect?journeyId=${journeyId}`}
              className="px-3.5 py-2 rounded-full text-xs font-bold shrink-0 flex items-center gap-1.5"
              style={{ background: `${themeA}33`, color: themeA }}
            >
              <Link2 size={12} /> Conectar
            </a>
          )}
        </div>
        {strava?.connected && (
          <div className="text-[11px] text-[#5CFF8F] font-semibold mt-2 flex items-center gap-1">
            <CheckCircle2 size={12} /> As novas corridas do Strava entram como um registro comum na jornada.
          </div>
        )}
      </div>

      {/* Garmin */}
      <ComingSoonProvider name={PROVIDER_LABEL.garmin} note="A Garmin suspendeu novos cadastros no programa de desenvolvedores — assim que reabrir, essa conexão fica disponível aqui." />

      {/* Samsung Health */}
      <ComingSoonProvider name={PROVIDER_LABEL.samsung} note="O acesso à API da Samsung Health depende de aprovação empresarial da Samsung. Dica: se você já sincroniza a Samsung Health com o Strava (pelo próprio app da Samsung), suas corridas já aparecem aqui ao conectar o Strava acima." />

      {msg && <div className="text-xs text-muted font-semibold px-1">{msg}</div>}
    </div>
  );
}

function ComingSoonProvider({ name, note }: { name: string; note: string }) {
  return (
    <div className="bg-surface rounded-2xl p-4 opacity-60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-extrabold shrink-0">
            {name[0]}
          </div>
          <div className="text-sm font-bold">{name}</div>
        </div>
        <span className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-white/5 text-muted shrink-0">Em breve</span>
      </div>
      <div className="text-[11px] text-muted mt-2">{note}</div>
    </div>
  );
}
