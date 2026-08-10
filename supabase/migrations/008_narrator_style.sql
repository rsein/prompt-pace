-- Migração: estilo de narrador por jornada (escolhido na criação ou edição).
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

alter table public.journeys
  add column if not exists narrator_style text not null default 'engracado'
  check (narrator_style in ('engracado','serio','chefe','treinador','pastor','simpatico','corporativo','locutor','apresentador'));
