import { createClient } from "@/lib/supabase/server";
import HomeClient from "@/components/HomeClient";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("journey_members")
    .select("journey_id, journeys(*)")
    .eq("user_id", user!.id);

  const journeys = (memberships ?? []).map((m: any) => m.journeys).filter(Boolean);

  const journeysWithStats = await Promise.all(
    journeys.map(async (j: any) => {
      const { data: runs } = await supabase.from("runs").select("km, created_at").eq("journey_id", j.id);
      const now = new Date();
      const monthlyKm = (runs ?? [])
        .filter((r: any) => {
          const d = new Date(r.created_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        })
        .reduce((s: number, r: any) => s + Number(r.km), 0);
      const annualKm = (runs ?? [])
        .filter((r: any) => new Date(r.created_at).getFullYear() === now.getFullYear())
        .reduce((s: number, r: any) => s + Number(r.km), 0);
      const lastActivity = (runs ?? []).reduce(
        (latest: string, r: any) => (r.created_at > latest ? r.created_at : latest),
        j.created_at
      );
      return { ...j, monthlyKm, annualKm, lastActivity };
    })
  );

  return <HomeClient userId={user!.id} journeys={journeysWithStats} />;
}
