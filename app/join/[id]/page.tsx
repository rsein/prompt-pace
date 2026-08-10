import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import JoinClient from "@/components/JoinClient";

export default async function JoinPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/join/${params.id}`);

  // Usa o client admin aqui porque quem ainda não é membro não passa na regra normal de
  // "jornada visível só pra membros" — só queremos exibir o nome/tema pra tela de convite.
  const admin = createAdminClient();
  const { data: journey } = await admin
    .from("journeys")
    .select("id, title, season, theme_a, theme_b")
    .eq("id", params.id)
    .maybeSingle();

  if (!journey) redirect("/home");

  const { data: existing } = await admin
    .from("journey_members")
    .select("user_id, status")
    .eq("journey_id", journey.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.status === "accepted") redirect(`/journey/${journey.id}`);

  if (existing?.status === "pending") {
    // já tinha sido convidado por busca de nome — clicar no link é a confirmação, aceita direto
    await admin.from("journey_members").update({ status: "accepted" }).eq("journey_id", journey.id).eq("user_id", user.id);
    redirect(`/journey/${journey.id}`);
  }

  return <JoinClient journey={journey} />;
}
