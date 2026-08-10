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

async function generateNudge(name: string, hoursSince: number): Promise<string> {
  const fallback = `${name}, faz tempo que você não corre — bora se mexer hoje?`;
  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 40,
        temperature: 1,
        messages: [
          {
            role: "system",
            content:
              "Você escreve UMA notificação push curta (máximo 15 palavras) em português do Brasil, chamando a pessoa pra voltar a correr — ela está há um tempo sem registrar corrida. Tom leve, engraçado ou motivador (nunca culpa pesada ou cobrança agressiva). Pode usar o nome da pessoa. Responda só a frase, sem aspas.",
          },
          {
            role: "user",
            content: `Nome: ${name}. Está há aproximadamente ${Math.round(hoursSince / 24)} dias sem correr.`,
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") || fallback;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  // Protege o endpoint — só o próprio Vercel Cron (com o header certo) ou quem souber o CRON_SECRET pode chamar
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ sent: 0, skipped: "vapid não configurado" });
  }
  ensureVapid();

  const admin = createAdminClient();
  const now = Date.now();
  const RENUDGE_AFTER = 48 * 3600 * 1000; // não notifica de novo antes de outras 48h

  const { data: profiles } = await admin.from("profiles").select("id, name, last_inactivity_nudge_at");
  if (!profiles || profiles.length === 0) return NextResponse.json({ sent: 0 });

  let sent = 0;
  let checked = 0;

  for (const profile of profiles) {
    // só notifica quem já tem alguma assinatura de push ativa — sem isso não tem pra onde mandar
    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", profile.id);
    if (!subs || subs.length === 0) continue;

    const { data: lastRun } = await admin
      .from("runs")
      .select("created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastRun) continue; // nunca correu — não faz sentido cobrar ainda
    checked++;

    const hoursSince = (now - new Date(lastRun.created_at).getTime()) / 3600000;
    if (hoursSince < 48) continue;

    if (profile.last_inactivity_nudge_at) {
      const sinceLastNudge = now - new Date(profile.last_inactivity_nudge_at).getTime();
      if (sinceLastNudge < RENUDGE_AFTER) continue;
    }

    const message = await generateNudge(profile.name, hoursSince);

    let anySent = false;
    await Promise.all(
      subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title: "Prompt & Pace 🏃", body: message, url: "/home" })
          );
          anySent = true;
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      })
    );

    if (anySent) {
      sent++;
      await admin.from("profiles").update({ last_inactivity_nudge_at: new Date().toISOString() }).eq("id", profile.id);
    }
  }

  return NextResponse.json({ checked, sent });
}
