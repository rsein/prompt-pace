-- Migração: corrige o índice parcial que impedia o "upsert" de funcionar (Postgres não casa
-- ON CONFLICT com índice parcial sem repetir a condição WHERE) — isso provavelmente é a causa
-- do botão de sincronizar e do "adicionar corrida a uma jornada" não funcionarem.
-- Também cria uma lista de exclusão: se você apagar uma corrida do Strava de dentro de uma
-- jornada, ela não pode "voltar sozinha" da próxima vez que sincronizar.
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

-- 1. Troca o índice parcial por uma constraint única de verdade (NULL nunca conflita com NULL,
-- então corridas manuais com external_id nulo continuam livres pra se repetir sem problema —
-- não precisa mais da condição "where external_id is not null").
drop index if exists runs_external_unique;

alter table public.runs
  drop constraint if exists runs_external_unique;

alter table public.runs
  add constraint runs_external_unique unique (journey_id, source, external_id);

-- 2. Lista de corridas do Strava que foram excluídas manualmente de uma jornada específica —
-- o processo de sincronização confere essa lista antes de reinserir qualquer coisa.
create table if not exists public.excluded_strava_runs (
  journey_id uuid not null references public.journeys(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  external_id text not null,
  excluded_at timestamptz not null default now(),
  primary key (journey_id, user_id, external_id)
);

alter table public.excluded_strava_runs enable row level security;

drop policy if exists "user manages own exclusions" on public.excluded_strava_runs;
create policy "user manages own exclusions"
  on public.excluded_strava_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
