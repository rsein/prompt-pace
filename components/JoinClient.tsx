"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function JoinClient({
  journey,
}: {
  journey: { id: string; title: string; season: string; theme_a: string; theme_b: string };
}) {
  const supabase = createClient();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [importPrompt, setImportPrompt] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function handleJoin() {
    setJoining(true);
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sessão expirada, faz login de novo.");
      setJoining(false);
      return;
    }

    // Clicar aqui já é o consentimento — entra direto como aceito, sem precisar de confirmação extra
    const { error: err } = await supabase
      .from("journey_members")
      .insert({ journey_id: journey.id, user_id: user.id, status: "accepted" });

    if (err) {
      setError(err.message || "Não consegui te adicionar. Tenta de novo.");
      setJoining(false);
      return;
    }

    setJoining(false);

    try {
      const statusData = await fetch("/api/wearables/status").then((r) => r.json());
      const stravaConnected = (statusData.statuses ?? []).find(
        (s: { provider: string; connected: boolean }) => s.provider === "strava"
      )?.connected;
      if (stravaConnected) {
        setImportPrompt(true);
        return;
      }
    } catch {
      // sem problema, só não pergunta
    }

    router.push(`/journey/${journey.id}`);
    router.refresh();
  }

  async function handleImportChoice(importFromStrava: boolean) {
    if (!importFromStrava) {
      router.push(`/journey/${journey.id}`);
      router.refresh();
      return;
    }
    setImporting(true);
    const sinceDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    try {
      const res = await fetch("/api/strava/import-for-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId: journey.id, sinceDate }),
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
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background: `radial-gradient(120% 140% at 20% -10%, ${journey.theme_b}44, transparent), radial-gradient(120% 140% at 100% 0%, ${journey.theme_a}33, transparent)`,
      }}
    >
      <div className="max-w-sm w-full text-center">
        <Sparkles size={28} color={journey.theme_a} className="mx-auto mb-4" />

        {!importPrompt ? (
          <>
            <div className="text-xs font-extrabold uppercase tracking-wide text-muted mb-1">Você foi convidado pra</div>
            <div className="font-display text-4xl mb-1.5">{journey.title}</div>
            <div className="text-sm text-muted font-semibold mb-8">{journey.season}</div>

            {error && <div className="text-xs text-red-400 font-semibold mb-4">{error}</div>}

            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-bg"
              style={{ background: `linear-gradient(90deg, ${journey.theme_a}, ${journey.theme_b})`, opacity: joining ? 0.7 : 1 }}
            >
              {joining ? "Entrando..." : "Entrar na jornada"}
            </button>
          </>
        ) : (
          <>
            <div className="font-display text-3xl mb-1.5">Você entrou! 🎉</div>
            {importResult ? (
              <>
                <div className="text-sm text-muted mb-8 leading-relaxed">{importResult}</div>
                <button
                  onClick={() => {
                    router.push(`/journey/${journey.id}`);
                    router.refresh();
                  }}
                  className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-bg"
                  style={{ background: `linear-gradient(90deg, ${journey.theme_a}, ${journey.theme_b})` }}
                >
                  Ver jornada
                </button>
              </>
            ) : (
              <>
                <div className="text-sm text-muted mb-8 leading-relaxed">
                  Quer importar as corridas que já fez esse mês pelo Strava, pra já contar no ranking?
                </div>
                <button
                  onClick={() => handleImportChoice(true)}
                  disabled={importing}
                  className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-bg mb-2.5"
                  style={{ background: `linear-gradient(90deg, ${journey.theme_a}, ${journey.theme_b})`, opacity: importing ? 0.7 : 1 }}
                >
                  {importing ? "Importando..." : "Importar do Strava"}
                </button>
                <button
                  onClick={() => handleImportChoice(false)}
                  disabled={importing}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm"
                  style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  Começar do zero
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
