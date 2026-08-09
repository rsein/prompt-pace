import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WearableProvider, WearableStatus } from "@/lib/types";

const PROVIDERS: { id: WearableProvider; available: boolean }[] = [
  { id: "strava", available: true },
  // Garmin e Samsung Health exigem aprovação prévia do provedor (ver README) —
  // a estrutura já existe no banco, só falta virar "available: true" quando as credenciais chegarem.
  { id: "garmin", available: false },
  { id: "samsung", available: false },
];

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("wearable_connections")
    .select("provider, last_synced_at")
    .eq("user_id", user.id);

  const statuses: WearableStatus[] = PROVIDERS.map((p) => {
    const row = (rows ?? []).find((r: { provider: string }) => r.provider === p.id);
    return {
      provider: p.id,
      available: p.available,
      connected: !!row,
      lastSyncedAt: row?.last_synced_at ?? null,
    };
  });

  return NextResponse.json({ statuses });
}
