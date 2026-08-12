-- Migração: reações (tipo curtida com emoji) nas corridas registradas dentro de uma jornada.
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

create table if not exists public.run_reactions (
  run_id uuid not null references public.runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (run_id, user_id)
);

alter table public.run_reactions enable row level security;

-- Só quem é membro aceito da jornada dona da corrida pode ver/reagir — mesma regra das corridas
drop policy if exists "reactions viewable by accepted journey members" on public.run_reactions;
create policy "reactions viewable by accepted journey members"
  on public.run_reactions for select
  using (
    exists (
      select 1 from public.runs r
      join public.journey_members jm on jm.journey_id = r.journey_id
      where r.id = run_reactions.run_id
      and jm.user_id = auth.uid()
      and jm.status = 'accepted'
    )
  );

drop policy if exists "accepted member can react" on public.run_reactions;
create policy "accepted member can react"
  on public.run_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.runs r
      join public.journey_members jm on jm.journey_id = r.journey_id
      where r.id = run_reactions.run_id
      and jm.user_id = auth.uid()
      and jm.status = 'accepted'
    )
  );

drop policy if exists "user can update own reaction" on public.run_reactions;
create policy "user can update own reaction"
  on public.run_reactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user can remove own reaction" on public.run_reactions;
create policy "user can remove own reaction"
  on public.run_reactions for delete
  using (auth.uid() = user_id);
