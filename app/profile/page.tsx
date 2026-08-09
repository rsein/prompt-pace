import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "@/components/ProfileClient";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const { data: memberships } = await supabase
    .from("journey_members")
    .select("journeys(id, title, theme_a)")
    .eq("user_id", user.id);

  const journeys = (memberships ?? [])
    .map((m: any) => m.journeys)
    .filter(Boolean) as { id: string; title: string; theme_a: string }[];

  if (!profile) redirect("/login");

  return <ProfileClient profile={profile} userId={user.id} email={user.email ?? ""} journeys={journeys} />;
}
