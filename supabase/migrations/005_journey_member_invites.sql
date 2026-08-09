-- Migração: permite que quem já é membro de uma jornada adicione outras pessoas como membro
-- (antes, cada usuário só podia inserir a própria linha em journey_members — por isso "adicionar amigo"
-- na criação/edição de jornada nunca funcionava pelo app, só via SQL Editor manual).
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

drop policy if exists "users can join a journey" on public.journey_members;

create policy "self or existing member can add journey members"
  on public.journey_members for insert
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.journey_members jm
      where jm.journey_id = journey_members.journey_id
      and jm.user_id = auth.uid()
    )
  );
