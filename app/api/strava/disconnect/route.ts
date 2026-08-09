import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("wearable_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "strava");

  if (error) return NextResponse.json({ error: "Não consegui desconectar agora." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
