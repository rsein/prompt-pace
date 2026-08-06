-- Migração: período mensal/anual por jornada + calorias na corrida + editar/excluir jornada
-- Rode isso no SQL Editor do Supabase depois do schema.sql inicial.

alter table public.journeys
  add column if not exists period_monthly boolean not null default true,
  add column if not exists period_annual boolean not null default false,
  add column if not exists monthly_goal_km numeric,
  add column if not exists annual_goal_km numeric;

alter table public.journeys alter column goal_km drop not null;
alter table public.journeys alter column ends_on drop not null;

alter table public.runs
  add column if not exists calories integer;

-- Jornadas criadas antes dessa migração usavam "goal_km" direto — preenche a meta mensal com esse valor
-- pra não ficarem com meta em branco depois da migração.
update public.journeys
  set monthly_goal_km = goal_km
  where monthly_goal_km is null and goal_km is not null;

create policy "creator can update journey"
  on public.journeys for update
  using (auth.uid() = created_by);

create policy "creator can delete journey"
  on public.journeys for delete
  using (auth.uid() = created_by);
