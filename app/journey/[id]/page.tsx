import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JourneyClient from "@/components/JourneyClient";
import type { Journey, Profile, Run } from "@/lib/types";

export default async function JourneyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: journey } = await supabase
    .from("journeys")
    .select("*")
    .eq("id", params.id)
    .single<Journey>();

  if (!journey) notFound();

  const { data: allMemberships } = await supabase
    .from("journey_members")
    .select("journeys(id, title, theme_a, theme_b)")
    .eq("user_id", user.id)
    .eq("status", "accepted");

  const allJourneys = (allMemberships ?? [])
    .map((m: any) => m.journeys)
    .filter(Boolean) as { id: string; title: string; theme_a: string; theme_b: string }[];

  const { data: memberRows } = await supabase
    .from("journey_members")
    .select("profiles(*)")
    .eq("journey_id", params.id)
    .eq("status", "accepted");

  const members = (memberRows ?? [])
    .map((row: any) => row.profiles)
    .filter(Boolean) as Profile[];

  const { data: runs } = await supabase
    .from("runs")
    .select("*")
    .eq("journey_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <JourneyClient
      journey={journey}
      members={members}
      initialRuns={(runs ?? []) as Run[]}
      currentUserId={user.id}
      allJourneys={allJourneys}
    />
  );
}
