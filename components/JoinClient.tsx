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

    const { error: err } = await supabase
      .from("journey_members")
      .insert({ journey_id: journey.id, user_id: user.id });

    if (err) {
      setError(err.message || "Não consegui te adicionar. Tenta de novo.");
      setJoining(false);
      return;
    }

    router.push(`/journey/${journey.id}`);
    router.refresh();
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
      </div>
    </div>
  );
}
