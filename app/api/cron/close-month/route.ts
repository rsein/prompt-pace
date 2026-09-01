import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { brazilParts } from "@/lib/utils";

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

export async function GET(request: Request) {
  // Protege o endpoint — só o próprio Vercel Cron (com o header certo) ou quem souber o CRON_SECRET pode chamar
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Sempre olha pro mês ANTERIOR ao atual — roda todo dia, mas só faz alguma coisa de fato uma
  // vez por mês, quando ainda não existe resultado salvo pra esse mês (evita duplicar e também
  // não depende de rodar bem na hora exata da virada do mês).
  const nowParts = brazilParts();
  const prevMonthIndex = nowParts.month === 0 ? 11 : nowParts.month - 1;
  const year = nowParts.month === 0 ? nowParts.year - 1 : nowParts.year;
  const month = prevMonthIndex + 1; // 1-12
  const monthLabel = new Date(Date.UTC(year, prevMonthIndex, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // Meia-noite no Brasil = 03:00 UTC (fuso fixo, sem horário de verão atualmente)
  const periodStart = new Date(Date.UTC(year, prevMonthIndex, 1, 3, 0, 0)).toISOString();
  const periodEnd = new Date(Date.UTC(year, prevMonthIndex + 1, 1, 3, 0, 0)).toISOString();

  const { data: journeys } = await admin
    .from("journeys")
    .select("id, title, monthly_goal_km")
    .not("monthly_goal_km", "is", null)
    .gt("monthly_goal_km", 0);

  if (!journeys || journeys.length === 0) return NextResponse.json({ processed: 0 });

  let processed = 0;
  let notified = 0;

  for (const journey of journeys) {
    // já fechamos esse mês pra essa jornada? não refaz
    const { data: existing } = await admin
      .from("journey_month_results")
      .select("journey_id")
      .eq("journey_id", journey.id)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();
    if (existing) continue;

    const { data: monthRuns } = await admin
      .from("runs")
      .select("km")
      .eq("journey_id", journey.id)
      .gte("created_at", periodStart)
      .lt("created_at", periodEnd);

    // se a jornada nem tinha sido criada nesse mês (sem nenhuma corrida e criada depois), não faz sentido fechar
    if (!monthRuns) continue;

    const achievedKm = (monthRuns ?? []).reduce((s: number, r: { km: number }) => s + Number(r.km), 0);
    const goalKm = Number(journey.monthly_goal_km);
    const completed = achievedKm >= goalKm;

    await admin.from("journey_month_results").insert({
      journey_id: journey.id,
      year,
      month,
      goal_km: goalKm,
      achieved_km: Math.round(achievedKm * 10) / 10,
      completed,
    });
    processed++;

    if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) continue;
    ensureVapid();

    const { data: members } = await admin
      .from("journey_members")
      .select("user_id")
      .eq("journey_id", journey.id)
      .eq("status", "accepted");
    if (!members || members.length === 0) continue;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("*")
      .in(
        "user_id",
        members.map((m: { user_id: string }) => m.user_id)
      );
    if (!subs || subs.length === 0) continue;

    const title = completed ? "Parabéns, Meta Concluída! 🎉" : "Não foi dessa vez! 😕";
    const diff = Math.round(Math.abs(achievedKm - goalKm) * 10) / 10;
    const body = completed
      ? `${journey.title} fechou ${monthLabel} com ${achievedKm.toFixed(1)}km (meta era ${goalKm}km) — ${diff}km acima!`
      : `${journey.title} fechou ${monthLabel} com ${achievedKm.toFixed(1)}km de ${goalKm}km — faltaram ${diff}km.`;

    await Promise.all(
      subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title, body, url: `/journey/${journey.id}` })
          );
          notified++;
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      })
    );
  }

  return NextResponse.json({ processed, notified });
}
