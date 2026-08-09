// Helpers pra integração com a API v3 do Strava (OAuth2).
// Docs: https://developers.strava.com/docs/authentication/

export function stravaAuthorizeUrl(journeyId: string) {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/strava/callback`;
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all",
    state: journeyId,
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
};
