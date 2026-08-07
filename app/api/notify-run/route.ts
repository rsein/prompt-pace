import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    "mailto:contato@promptpace.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidConfigured = true;
}

export async function POST(request: Request) {
  const { journeyId, runnerId, runnerName, comment } = await request.json();

  if (!journeyId || !runnerId || !comment) {
    return NextResponse.json({ error: "Dados faltando" }, { status: 400 });
  }

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    // Notificação push não configurada ainda — não quebra o registro da corrida, só não notifica.
    return NextResponse.json({ sent: 0, skipped: "vapid não configurado" });
  }
  ensureVapid();

  const supabase = createAdminClient();

  const { data: memberRows } = await supabase
    .from("journey_members")
    .select("user_id")
    .eq("journey_id", journeyId);

  const otherIds = (memberRows ?? [])
    .map((m: { user_id: string }) => m.user_id)
    .filter((id: string) => id !== runnerId);

  if (otherIds.length === 0) return NextResponse.json({ sent: 0 });

  const { data: subs } = await supabase.from("push_subscriptions").select("*").in("user_id", otherIds);

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `${runnerName || "Alguém"} registrou uma corrida 🏃`,
            body: comment,
            url: `/journey/${journeyId}`,
          })
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );

  return NextResponse.json({ sent });
}
