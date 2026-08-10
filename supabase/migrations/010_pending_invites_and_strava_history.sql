-- Migração: sistema de convite pendente (quando alguém te adiciona buscando por nome, você
-- precisa aceitar antes de entrar de verdade) + arquivo histórico pessoal do Strava (todos os
-- anos, não só o que foi importado pra cada jornada).
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

-- 1. Status do convite em journey_members
alter table public.journey_members
  add column if not exists status text not null default 'accepted' check (status in ('pending', 'accepted'));

-- 2. Corridas só ficam visíveis pra quem já ACEITOU o convite (não pra quem só foi convidado)
drop policy if exists "runs viewable by journey members" on public.runs;
create policy "runs viewable by accepted journey members"
  on public.runs for select
  using (
    exists (
      select 1 from public.journey_members
      where journey_members.journey_id = runs.journey_id
      and journey_members.user_id = auth.uid()
      and journey_members.status = 'accepted'
    )
  );

-- 3. Só membro que já aceitou pode convidar outras pessoas (evita convite em cadeia por quem nem entrou ainda)
drop policy if exists "self or existing member can add journey members" on public.journey_members;
create policy "self or accepted member can add journey members"
  on public.journey_members for insert
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.journey_members jm
      where jm.journey_id = journey_members.journey_id
      and jm.user_id = auth.uid()
      and jm.status = 'accepted'
    )
  );

-- 4. Permite aceitar convite (mudar de pending pra accepted) e sair de uma jornada (deletar a própria linha)
drop policy if exists "user can update own membership" on public.journey_members;
create policy "user can update own membership"
  on public.journey_members for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user can leave or decline a journey" on public.journey_members;
create policy "user can leave or decline a journey"
  on public.journey_members for delete
  using (auth.uid() = user_id);

-- 5. Arquivo pessoal completo do Strava — independe de jornada, acumula ano após ano.
-- Usado pra estatísticas pessoais precisas (Home / página de estatísticas), já que uma
-- mesma corrida pode estar espelhada em várias jornadas mas só existe UMA vez aqui.
create table if not exists public.strava_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  external_id text not null,
  km numeric not null,
  time_sec integer not null,
  bpm integer,
  calories integer,
  created_at timestamptz not null,
  primary key (user_id, external_id)
);

alter table public.strava_history enable row level security;

drop policy if exists "user manages own strava history" on public.strava_history;
create policy "user manages own strava history"
  on public.strava_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
