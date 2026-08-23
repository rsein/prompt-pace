export type Profile = {
  id: string;
  name: string;
  avatar_url: string | null;
  color: string;
  gender?: "masculino" | "feminino" | "prefiro_nao_dizer" | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  ethnicity?: string | null;
  age?: number | null;
  phone?: string | null;
};



export type Journey = {
  id: string;
  title: string;
  season: string;
  theme_a: string;
  theme_b: string;
  starts_on: string;
  created_by: string;
  created_at: string;
  period_monthly: boolean;
  period_annual: boolean;
  monthly_goal_km: number | null;
  annual_goal_km: number | null;
  narrator_style: string;
};

export type Run = {
  id: string;
  journey_id: string;
  user_id: string;
  km: number;
  time_sec: number;
  bpm: number | null;
  calories: number | null;
  created_at: string;
  source?: string;
  external_id?: string | null;
  polyline?: string | null;
};

export type MemberTotal = Profile & {
  km: number;
  runsCount: number;
  timeSec: number;
};

export type WearableProvider = "strava" | "garmin" | "samsung";

export type WearableStatus = {
  provider: WearableProvider;
  connected: boolean;
  lastSyncedAt: string | null;
  available: boolean; // false = ainda não dá pra conectar (aprovação pendente do provedor)
};
