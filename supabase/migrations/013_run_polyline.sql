-- Migração: guarda o traçado (polyline) da corrida vinda do Strava, pra poder desenhar o mapa
-- do percurso. Corridas manuais/por foto continuam sem traçado — nunca tiveram GPS pra começo.
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

alter table public.runs
  add column if not exists polyline text;

alter table public.strava_history
  add column if not exists polyline text;
