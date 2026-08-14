"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Pencil, Trash2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Journey } from "@/lib/types";

export default function JourneyCardMenu({
  journey,
  currentUserId,
  onEdit,
  onDeleted,
}: {
  journey: Journey;
  currentUserId: string;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isCreator = journey.created_by === currentUserId;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleDelete() {
    setBusy(true);
    await supabase.from("journeys").delete().eq("id", journey.id);
    setBusy(false);
    setConfirming(false);
    setOpen(false);
    onDeleted();
  }

  async function handleLeave() {
    setBusy(true);
    await supabase.from("journey_members").delete().eq("journey_id", journey.id).eq("user_id", currentUserId);
    setBusy(false);
    setConfirming(false);
    setOpen(false);
    onDeleted();
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:bg-white/10"
      >
        <MoreVertical size={16} />
      </button>

      {open && !confirming && (
        <div className="absolute right-0 top-9 z-20 bg-surface2 border border-white/10 rounded-xl overflow-hidden w-44 shadow-xl">
          {isCreator ? (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  onEdit();
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-left hover:bg-white/5"
              >
                <Pencil size={14} /> Editar
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setConfirming(true);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-left text-red-400 hover:bg-white/5"
              >
                <Trash2 size={14} /> Excluir
              </button>
            </>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                setConfirming(true);
              }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-left text-red-400 hover:bg-white/5"
            >
              <LogOut size={14} /> Sair da jornada
            </button>
          )}
        </div>
      )}

      {open && confirming && (
        <div className="absolute right-0 top-9 z-20 bg-surface2 border border-white/10 rounded-xl p-4 w-56 shadow-xl">
          {isCreator ? (
            <>
              <div className="text-sm font-bold mb-1">Excluir "{journey.title}"?</div>
              <div className="text-xs text-muted mb-3">
                Isso apaga a jornada e todas as corridas registradas nela, pra todo mundo. Não dá pra desfazer.
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold mb-1">Sair de "{journey.title}"?</div>
              <div className="text-xs text-muted mb-3">
                Você deixa de ver essa jornada e sai do ranking. Suas corridas registradas continuam lá pros outros, mas dá pra
                voltar depois se alguém te convidar de novo.
              </div>
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                setConfirming(false);
              }}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                isCreator ? handleDelete() : handleLeave();
              }}
              disabled={busy}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-red-500/80 text-white"
            >
              {busy ? "..." : isCreator ? "Excluir" : "Sair"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
