-- Migração: guarda o resultado FECHADO de cada mês por jornada (meta que valia naquele mês,
-- quanto foi feito, se bateu ou não). Guardamos um "retrato" em vez de calcular na hora, porque
-- se a meta da jornada mudar depois, o histórico de meses passados não pode mudar junto.
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

create table if not exists public.journey_month_results (
  journey_id uuid not null references public.journeys(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  goal_km numeric not null,
  achieved_km numeric not null,
  completed boolean not null,
  created_at timestamptz not null default now(),
  primary key (journey_id, year, month)
);

alter table public.journey_month_results enable row level security;

drop policy if exists "accepted members view month results" on public.journey_month_results;
create policy "accepted members view month results"
  on public.journey_month_results for select
  using (
    exists (
      select 1 from public.journey_members jm
      where jm.journey_id = journey_month_results.journey_id
      and jm.user_id = auth.uid()
      and jm.status = 'accepted'
    )
  );
