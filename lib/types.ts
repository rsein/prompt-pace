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
  goal_km: number;
  theme_a: string;
  theme_b: string;
  starts_on: string;
  ends_on: string;
};

export type Run = {
  id: string;
  journey_id: string;
  user_id: string;
  km: number;
  time_sec: number;
  bpm: number | null;
  created_at: string;
};

export type MemberTotal = Profile & {
  km: number;
  runsCount: number;
  timeSec: number;
};
