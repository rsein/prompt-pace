"use client";

import { useState, useEffect } from "react";
import { X, Search, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Journey, Profile } from "@/lib/types";

const THEME_PRESETS = [
  { a: "#29F1D6", b: "#8B5CF6" },
  { a: "#FFC145", b: "#FF5C8A" },
  { a: "#5CFF8F", b: "#29A8F1" },
  { a: "#FF7A5C", b: "#8B5CF6" },
];

export default function JourneyFormModal({
  userId,
  journey,
  onClose,
  onSaved,
}: {
  userId: string;
  journey?: Journey;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const isEdit = !!journey;

  const [title, setTitle] = useState(journey?.title ?? "");
  const [monthly, setMonthly] = useState(journey?.period_monthly ?? true);
  const [annual, setAnnual] = useState(journey?.period_annual ?? false);
  const [monthlyGoal, setMonthlyGoal] = useState(journey?.monthly_goal_km ? String(journey.monthly_goal_km) : "");
  const [annualGoal, setAnnualGoal] = useState(journey?.annual_goal_km ? String(journey.annual_goal_km) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Participantes: busca por nome + sugestões de quem já correu com você antes
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Profile[]>([]);

  useEffect(() => {
    (async () => {
      const { data: myMemberships } = await supabase.from("journey_members").select("journey_id").eq("user_id", userId);
      const journeyIds = (myMemberships ?? []).map((m) => m.journey_id);
      if (journeyIds.length === 0) return;

      const { data: coMembers } = await supabase
        .from("journey_members")
        .select("profiles(*)")
        .in("journey_id", journeyIds)
        .neq("user_id", userId);

      const unique = new Map<string, Profile>();
      (coMembers ?? []).forEach((row: any) => {
        if (row.profiles) unique.set(row.profiles.id, row.profiles);
      });
      setSuggestions(Array.from(unique.values()));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .ilike("name", `%${query.trim()}%`)
        .neq("id", userId)
        .limit(8);
      setSearchResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function toggleSelect(profile: Profile) {
    setSelected((prev) =>
      prev.some((p) => p.id === profile.id) ? prev.filter((p) => p.id !== profile.id) : [...prev, profile]
    );
  }

  async function handleSubmit() {
    setError("");
    if (!title.trim()) {
      setError("Dá um nome pra jornada.");
      return;
    }
    if (!monthly && !annual) {
      setError("Escolhe pelo menos um período: mensal ou anual.");
      return;
    }
    if (monthly && !monthlyGoal) {
      setError("Define a meta mensal (em km).");
      return;
    }
    if (annual && !annualGoal) {
      setError("Define a meta anual (em km).");
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      season: monthly && !annual ? "Mensal" : annual && !monthly ? "Anual" : "Mensal + Anual",
      period_monthly: monthly,
      period_annual: annual,
      monthly_goal_km: monthly ? parseFloat(monthlyGoal.replace(",", ".")) : null,
      annual_goal_km: annual ? parseFloat(annualGoal.replace(",", ".")) : null,
    };

    if (isEdit) {
      const { error: err } = await supabase.from("journeys").update(payload).eq("id", journey!.id);
      if (err) {
        console.error("Erro ao salvar jornada:", err);
        setError(err.message || "Não consegui salvar. Tenta de novo.");
        setSaving(false);
        return;
      }
      if (selected.length > 0) {
        await supabase
          .from("journey_members")
          .upsert(
            selected.map((p) => ({ journey_id: journey!.id, user_id: p.id })),
            { onConflict: "journey_id,user_id", ignoreDuplicates: true }
          );
      }
    } else {
      const preset = THEME_PRESETS[Math.floor(Math.random() * THEME_PRESETS.length)];
      const newId = crypto.randomUUID();
      const { error: err } = await supabase
        .from("journeys")
        .insert({ id: newId, ...payload, theme_a: preset.a, theme_b: preset.b, created_by: userId });

      if (err) {
        console.error("Erro ao criar jornada:", err);
        setError(err.message || "Não consegui criar. Tenta de novo.");
        setSaving(false);
        return;
      }

      // Primeiro entra você (satisfaz a regra "auth.uid() = user_id"), só depois convida os amigos —
      // a regra que permite convidar outras pessoas exige que você já seja membro da jornada.
      const { error: selfErr } = await supabase.from("journey_members").insert({ journey_id: newId, user_id: userId });
      if (selfErr) {
        console.error("Erro ao entrar na jornada criada:", selfErr);
        setError(`Jornada criada, mas não consegui te adicionar como membro: ${selfErr.message}`);
        setSaving(false);
        return;
      }

      const otherMemberIds = selected.map((p) => p.id).filter((id) => id !== userId);
      if (otherMemberIds.length > 0) {
        const { error: membersErr } = await supabase
          .from("journey_members")
          .insert(otherMemberIds.map((id) => ({ journey_id: newId, user_id: id })));
        if (membersErr) {
          console.error("Erro ao adicionar membros na jornada:", membersErr);
          setError(`Jornada criada, mas não consegui adicionar todo mundo: ${membersErr.message}`);
          setSaving(false);
          return;
        }
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-40">
      <div className="w-full max-w-md mx-auto bg-surface2 rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div className="font-display text-2xl">{isEdit ? "Editar jornada" : "Nova jornada"}</div>
          <button onClick={onClose} className="text-muted">
            <X size={20} />
          </button>
        </div>

        <label className="text-xs font-bold text-muted uppercase tracking-wide">Nome</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ex: Prompt & Pace"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-extrabold outline-none mt-2 mb-4"
        />

        <label className="text-xs font-bold text-muted uppercase tracking-wide">Período</label>
        <div className="flex gap-2 mt-2 mb-4">
          <button
            type="button"
            onClick={() => setMonthly((v) => !v)}
            className="flex-1 py-3 rounded-xl text-sm font-bold border"
            style={{
              background: monthly ? "#29F1D633" : "rgba(255,255,255,0.05)",
              borderColor: monthly ? "#29F1D6" : "transparent",
              color: monthly ? "#29F1D6" : "#F4F6FF",
            }}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setAnnual((v) => !v)}
            className="flex-1 py-3 rounded-xl text-sm font-bold border"
            style={{
              background: annual ? "#8B5CF633" : "rgba(255,255,255,0.05)",
              borderColor: annual ? "#8B5CF6" : "transparent",
              color: annual ? "#8B5CF6" : "#F4F6FF",
            }}
          >
            Anual
          </button>
        </div>
        <div className="text-[11px] text-muted mb-4 leading-relaxed">
          A meta mensal zera todo mês (sem perder o histórico). Se marcar os dois, a jornada mostra os dois rankings.
        </div>

        {monthly && (
          <>
            <label className="text-xs font-bold text-muted uppercase tracking-wide">Meta mensal (km)</label>
            <input
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value)}
              placeholder="ex: 200"
              inputMode="decimal"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-extrabold outline-none mt-2 mb-4"
            />
          </>
        )}

        {annual && (
          <>
            <label className="text-xs font-bold text-muted uppercase tracking-wide">Meta anual (km)</label>
            <input
              value={annualGoal}
              onChange={(e) => setAnnualGoal(e.target.value)}
              placeholder="ex: 1500"
              inputMode="decimal"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-extrabold outline-none mt-2 mb-4"
            />
          </>
        )}

        <>
          <label className="text-xs font-bold text-muted uppercase tracking-wide">
            {isEdit ? "Adicionar participantes" : "Participantes"}
          </label>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                {selected.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleSelect(p)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold"
                    style={{ background: `${p.color}33`, color: p.color }}
                  >
                    {p.name} <X size={11} />
                  </button>
                ))}
              </div>
            )}

            <div className="relative mt-2 mb-2">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm font-semibold outline-none"
              />
            </div>

            {query.trim().length >= 2 && (
              <div className="mb-3">
                {searching && <div className="text-xs text-muted px-1 py-1.5">Buscando...</div>}
                {!searching && searchResults.length === 0 && (
                  <div className="text-xs text-muted px-1 py-1.5">Ninguém encontrado com esse nome.</div>
                )}
                {searchResults.map((p) => {
                  const isSelected = selected.some((s) => s.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleSelect(p)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl mb-1"
                      style={{ background: isSelected ? `${p.color}22` : "rgba(255,255,255,0.03)" }}
                    >
                      <span className="text-sm font-semibold">{p.name}</span>
                      {isSelected && <Check size={14} color={p.color} />}
                    </button>
                  );
                })}
              </div>
            )}

            {suggestions.length > 0 && query.trim().length < 2 && (
              <div className="mb-4">
                <div className="text-[11px] text-muted font-semibold mb-1.5">Já correu com você antes:</div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions
                    .filter((s) => !selected.some((sel) => sel.id === s.id))
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => toggleSelect(p)}
                        className="px-2.5 py-1.5 rounded-full text-xs font-bold"
                        style={{ background: "rgba(255,255,255,0.06)", color: "#F4F6FF" }}
                      >
                        + {p.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="text-[11px] text-muted mb-4 leading-relaxed">
              {isEdit
                ? "Quem você marcar aqui entra na jornada assim que salvar."
                : "Você entra automaticamente. Só quem você buscar/marcar aqui entra também."}
            </div>
          </>

        {error && <div className="text-sm text-red-400 font-semibold mb-4">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-4 rounded-2xl font-extrabold text-sm text-bg bg-gradient-to-r from-[#29F1D6] to-[#8B5CF6]"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar jornada"}
        </button>
      </div>
    </div>
  );
}
