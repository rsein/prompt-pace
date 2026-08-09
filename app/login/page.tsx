"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/home";
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"masculino" | "feminino" | "prefiro_nao_dizer" | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, gender: gender || null } },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <div className="font-display text-4xl tracking-wide">Prompt & Pace</div>
        <div className="text-sm text-muted font-semibold mt-1">
          {mode === "login" ? "Entre para ver sua jornada" : "Crie sua conta"}
        </div>
      </div>

      <div className="flex bg-surface rounded-xl p-1 mb-6">
        <button
          onClick={() => setMode("login")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === "login" ? "bg-surface2 text-white" : "text-muted"}`}
        >
          Entrar
        </button>
        <button
          onClick={() => setMode("signup")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === "signup" ? "bg-surface2 text-white" : "text-muted"}`}
        >
          Criar conta
        </button>
      </div>

      <div className="space-y-3">
        {mode === "signup" && (
          <input
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
          />
        )}
        {mode === "signup" && (
          <div>
            <div className="text-xs text-muted font-bold mb-1.5 px-1">
              Gênero <span className="font-normal">(ajuda a IA a acertar seu rosto no pôster do ranking)</span>
            </div>
            <div className="flex gap-2">
              {[
                { v: "masculino", l: "Masculino" },
                { v: "feminino", l: "Feminino" },
                { v: "prefiro_nao_dizer", l: "Prefiro não dizer" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setGender(opt.v as typeof gender)}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold border"
                  style={{
                    background: gender === opt.v ? "rgba(41,241,214,0.15)" : "transparent",
                    borderColor: gender === opt.v ? "#29F1D6" : "rgba(255,255,255,0.1)",
                    color: gender === opt.v ? "#29F1D6" : "#8890B5",
                  }}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        )}
        <input
          placeholder="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
        />
        <input
          placeholder="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
        />

        {error && <div className="text-xs text-red-400 font-semibold">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-extrabold text-sm text-bg mt-2"
          style={{ background: "linear-gradient(90deg, #29F1D6, #8B5CF6)", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
