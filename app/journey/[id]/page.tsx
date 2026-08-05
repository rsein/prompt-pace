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

  const { data: memberRows } = await supabase
    .from("journey_members")
    .select("profiles(*)")
    .eq("journey_id", params.id);

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
    />
  );
}
