"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const EMOJIS = ["👏", "🔥", "💪", "😂", "❤️"];

export type Reaction = { run_id: string; user_id: string; emoji: string };

export default function RunReactions({
  runId,
  ownerId,
  journeyId,
  currentUserId,
  currentUserName,
  reactions,
  onChange,
}: {
  runId: string;
  ownerId: string;
  journeyId: string;
  currentUserId: string;
  currentUserName: string;
  reactions: Reaction[];
  onChange: () => void;
}) {
  const supabase = createClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const myReaction = reactions.find((r) => r.user_id === currentUserId);
  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  async function handlePick(emoji: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    setPickerOpen(false);

    try {
      if (myReaction?.emoji === emoji) {
        // toca no mesmo emoji que já reagiu — remove
        await supabase.from("run_reactions").delete().eq("run_id", runId).eq("user_id", currentUserId);
      } else {
        await supabase
          .from("run_reactions")
          .upsert({ run_id: runId, user_id: currentUserId, emoji }, { onConflict: "run_id,user_id" });
        fetch("/api/notify-reaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerId, reactorId: currentUserId, reactorName: currentUserName, emoji, journeyId }),
        }).catch(() => {});
      }
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {Object.entries(grouped).map(([emoji, count]) => (
        <button
          key={emoji}
          onClick={(e) => handlePick(emoji, e)}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
          style={{
            background: myReaction?.emoji === emoji ? "rgba(41,241,214,0.15)" : "rgba(255,255,255,0.06)",
            border: myReaction?.emoji === emoji ? "1px solid #29F1D6" : "1px solid transparent",
          }}
        >
          {emoji} {count}
        </button>
      ))}

      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((v) => !v);
          }}
          className="w-5 h-5 rounded-full flex items-center justify-center text-muted"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <Plus size={11} />
        </button>

        {pickerOpen && (
          <div
            className="absolute bottom-full left-0 mb-1.5 flex gap-1 px-2 py-1.5 rounded-full bg-surface2 shadow-lg z-10"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {EMOJIS.map((emoji) => (
              <button key={emoji} onClick={(e) => handlePick(emoji, e)} className="text-base leading-none px-0.5">
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
