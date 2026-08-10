"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Invite = {
  journey_id: string;
  journeys: { id: string; title: string; season: string; theme_a: string; theme_b: string };
};

export default function PendingInvites({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importPrompt, setImportPrompt] = useState<{ journeyId: string; title: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("journey_members")
      .select("journey_id, journeys(id, title, season, theme_a, theme_b)")
      .eq("user_id", userId)
      .eq("status", "pending");
    setInvites((data ?? []) as unknown as Invite[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAccept(invite: Invite) {
    setBusyId(invite.journey_id);
    await supabase
      .from("journey_members")
      .update({ status: "accepted" })
      .eq("journey_id", invite.journey_id)
      .eq("user_id", userId);
    setBusyId(null);
    setInvites((prev) => prev.filter((i) => i.journey_id !== invite.journey_id));

    try {
      const statusData = await fetch("/api/wearables/status").then((r) => r.json());
      const stravaConnected = (statusData.statuses ?? []).find(
        (s: { provider: string; connected: boolean }) => s.provider === "strava"
      )?.connected;
      if (stravaConnected) {
        setImportPrompt({ journeyId: invite.journey_id, title: invite.journeys.title });
        return;
      }
    } catch {
      // sem problema, só não pergunta
    }
    router.refresh();
  }

  async function handleDecline(invite: Invite) {
    setBusyId(invite.journey_id);
    await supabase.from("journey_members").delete().eq("journey_id", invite.journey_id).eq("user_id", userId);
    setBusyId(null);
    setInvites((prev) => prev.filter((i) => i.journey_id !== invite.journey_id));
  }

  async function handleImportChoice(importFromStrava: boolean) {
    if (!importPrompt) return;
    if (importFromStrava) {
      setImporting(true);
      const sinceDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      try {
        const res = await fetch("/api/strava/import-for-journey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journeyId: importPrompt.journeyId, sinceDate }),
        });
        const data = await res.json();
        setImportResult(
          !res.ok || data.error
            ? data.error || "Não consegui importar agora."
            : data.imported > 0
              ? `${data.imported} corrida(s) importada(s)!`
              : "Nenhuma corrida do Strava encontrada nesse período."
        );
      } catch {
        setImportResult("Não consegui importar agora.");
      }
      setImporting(false);
      return;
    }
    setImportPrompt(null);
    router.refresh();
  }

  if (importPrompt) {
    return (
      <div className="bg-surface rounded-2xl p-4 mb-5 text-center">
        {importResult ? (
          <>
            <div className="text-sm font-bold mb-3.5">{importResult}</div>
            <button
              onClick={() => {
                setImportPrompt(null);
                setImportResult(null);
                router.refresh();
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs text-bg bg-gradient-to-r from-[#29F1D6] to-[#8B5CF6]"
            >
              Fechar
            </button>
          </>
        ) : (
          <>
            <div className="text-sm font-bold mb-1.5">Você entrou em {importPrompt.title}! 🎉</div>
            <div className="text-xs text-muted mb-3.5 leading-relaxed">
              Quer importar as corridas que já fez esse mês pelo Strava, pra já contar no ranking?
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleImportChoice(true)}
                disabled={importing}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs text-bg bg-gradient-to-r from-[#29F1D6] to-[#8B5CF6]"
                style={{ opacity: importing ? 0.7 : 1 }}
              >
                {importing ? "Importando..." : "Importar"}
              </button>
              <button
                onClick={() => handleImportChoice(false)}
                disabled={importing}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              >
                Agora não
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (invites.length === 0) return null;

  return (
    <div className="mb-5 space-y-2">
      {invites.map((invite) => (
        <div key={invite.journey_id} className="bg-surface rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1" style={{ color: invite.journeys.theme_a }}>
              <Sparkles size={11} /> Convite
            </div>
            <div className="text-sm font-bold truncate">{invite.journeys.title}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleAccept(invite)}
              disabled={busyId === invite.journey_id}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: `${invite.journeys.theme_a}33`, color: invite.journeys.theme_a }}
              title="Aceitar"
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => handleDecline(invite)}
              disabled={busyId === invite.journey_id}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted"
              style={{ background: "rgba(255,255,255,0.06)" }}
              title="Recusar"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
