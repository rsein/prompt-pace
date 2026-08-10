-- Migração: guarda quando foi a última vez que mandamos o aviso de "faz tempo que você não corre",
-- pra não notificar todo dia a mesma pessoa parada.
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

alter table public.profiles
  add column if not exists last_inactivity_nudge_at timestamptz;
