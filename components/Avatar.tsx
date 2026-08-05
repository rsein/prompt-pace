import { initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export default function Avatar({ profile, size = 34 }: { profile: Profile; size?: number }) {
  if (profile.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt={profile.name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `1px solid ${profile.color}88`, flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `${profile.color}33`,
        border: `1px solid ${profile.color}88`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(10, size * 0.32),
        fontWeight: 800,
        color: profile.color,
        flexShrink: 0,
      }}
    >
      {initials(profile.name)}
    </div>
  );
}
