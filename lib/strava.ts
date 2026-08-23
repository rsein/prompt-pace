// Helpers pra integração com a API v3 do Strava (OAuth2).
// Docs: https://developers.strava.com/docs/authentication/

export function stravaAuthorizeUrl() {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/strava/callback`;
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all",
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeStravaCode(code: string) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao trocar o código do Strava: ${res.status}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete: { id: number };
  }>;
}

export async function refreshStravaToken(refreshToken: string) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao renovar o token do Strava: ${res.status}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_at: number }>;
}

export type StravaActivity = {
  id: number;
  type: string;
  sport_type: string;
  distance: number; // metros
  moving_time: number; // segundos
  start_date: string;
  average_heartrate?: number;
  calories?: number;
  map?: { summary_polyline?: string };
};

export function isRunActivity(a: StravaActivity) {
  return a.type === "Run" || a.sport_type === "Run" || a.sport_type === "TrailRun" || a.sport_type === "VirtualRun";
}

// Busca atividades do Strava a partir de uma data, paginando até acabar (ou até o limite de segurança).
// Usado tanto na sincronização normal (últimos 90 dias) quanto na importação de histórico completo.
export async function fetchStravaActivities(accessToken: string, afterUnixSeconds: number, maxPages = 10): Promise<StravaActivity[]> {
  const all: StravaActivity[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${afterUnixSeconds}&per_page=200&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Falha ao buscar atividades do Strava: ${res.status}`);
    const batch: StravaActivity[] = await res.json();
    all.push(...batch);
    if (batch.length < 200) break; // última página
  }
  return all;
}

// A lista de atividades às vezes vem sem o traçado (summary_polyline vazio) mesmo quando a
// corrida tem GPS de verdade — é uma inconsistência conhecida da API do Strava. Quando isso
// acontece, busca a atividade específica, que traz o traçado de forma mais confiável.
export async function fetchActivityPolyline(accessToken: string, activityId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.map?.polyline || data.map?.summary_polyline || null;
  } catch {
    return null;
  }
}
