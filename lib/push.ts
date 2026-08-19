"use client";

import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// Usa serviceWorker.ready em vez de getRegistration() — getRegistration() pode responder antes do
// service worker terminar de ativar logo depois de abrir o app, dizendo "sem inscrição" por engano
// mesmo quando na verdade existe uma válida. .ready espera o SW estar de fato pronto antes de checar.
export async function getPushSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function enablePushNotifications(userId: string) {
  if (!isPushSupported()) {
    throw new Error("Esse navegador não suporta notificações. No iPhone, precisa adicionar o app à Tela de Início primeiro.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação negada.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("Chave VAPID não configurada no projeto.");
  }

  // Reaproveita a inscrição existente se já tiver uma válida — evita gerar endpoint novo à toa
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = subscription.toJSON();
  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) throw new Error("Não consegui salvar a assinatura de notificação.");
}

export async function disablePushNotifications(userId: string) {
  const sub = await getPushSubscription();
  if (sub) {
    const supabase = createClient();
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("user_id", userId);
    await sub.unsubscribe();
  }
}

// Autocorreção: se a pessoa já autorizou notificação antes (permissão concedida no navegador) mas
// por algum motivo a inscrição sumiu (ex: reinstalou o app, trocou o service worker), reativa
// sozinho, sem pedir permissão de novo (o navegador já lembra que foi concedida) e sem interromper
// a pessoa com nenhum aviso — só conserta silenciosamente em segundo plano.
export async function ensurePushSubscription(userId: string) {
  if (!isPushSupported()) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  try {
    const existing = await getPushSubscription();
    if (existing) return; // já está tudo certo
    await enablePushNotifications(userId);
  } catch {
    // autocorreção é só um bônus — se falhar, a pessoa ainda pode reativar manualmente no Perfil
  }
}
