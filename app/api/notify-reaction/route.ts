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
  const { ownerId, reactorId, reactorName, emoji, journeyId } = await request.json();

  if (!ownerId || !reactorId || !emoji || !journeyId) {
    return NextResponse.json({ error: "Dados faltando" }, { status: 400 });
  }
  if (ownerId === reactorId) return NextResponse.json({ sent: 0 }); // não notifica reação na própria corrida

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ sent: 0, skipped: "vapid não configurado" });
  }
  ensureVapid();

  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", ownerId);

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: `${reactorName || "Alguém"} reagiu ${emoji} à sua corrida`,
            body: "Toca pra ver a jornada",
            url: `/journey/${journeyId}`,
          })
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );

  return NextResponse.json({ sent });
}
