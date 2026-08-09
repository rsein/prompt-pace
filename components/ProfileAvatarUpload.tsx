"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resizeImageFile, dataUrlToBlob } from "@/lib/utils";
import Avatar from "./Avatar";
import type { Profile } from "@/lib/types";

export default function ProfileAvatarUpload({
  profile,
  onUpdated,
}: {
  profile: Profile;
  onUpdated: (avatarUrl: string) => void;
}) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);

    try {
      const dataUrl = await resizeImageFile(file, 512, 0.85);
      const blob = dataUrlToBlob(dataUrl);
      const path = `${profile.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      // cache-busting pra imagem trocar na hora, já que o path é sempre o mesmo
      const bustedUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: bustedUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      onUpdated(bustedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui trocar a foto. Tenta de novo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-start">
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative"
        style={{ opacity: uploading ? 0.6 : 1 }}
      >
        <Avatar profile={profile} size={52} />
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: profile.color, border: "2px solid #05070F" }}
        >
          <Camera size={11} color="#05070F" strokeWidth={2.5} />
        </div>
      </button>
      {uploading && <div className="text-[11px] text-muted font-semibold mt-1.5">Enviando foto...</div>}
      {error && <div className="text-[11px] text-red-400 font-semibold mt-1.5">{error}</div>}
    </div>
  );
}
