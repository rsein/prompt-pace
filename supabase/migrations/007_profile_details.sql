-- Migração: campos extras de perfil (altura, peso, etnia, idade, telefone) —
-- usados pra mostrar o IMC no perfil e ajudar a IA a acertar a aparência no pôster.
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

alter table public.profiles
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric,
  add column if not exists ethnicity text,
  add column if not exists age int,
  add column if not exists phone text;
