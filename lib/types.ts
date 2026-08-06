export type Profile = {
  id: string;
  name: string;
  avatar_url: string | null;
  color: string;
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
};

export type MemberTotal = Profile & {
  km: number;
  runsCount: number;
  timeSec: number;
};
