-- Migração: cor diferente por participante + tabela de notificações push
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

-- 1. Trigger passa a distribuir cores de uma paleta, em vez de sempre a mesma
create or replace function public.handle_new_user()
returns trigger as $$
declare
  palette text[] := array['#29F1D6', '#8B5CF6', '#FFC145', '#FF6B9D', '#5CFF8F', '#FF7A5C'];
  existing_count int;
begin
  select count(*) into existing_count from public.profiles;

  insert into public.profiles (id, name, color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    palette[(existing_count % array_length(palette, 1)) + 1]
  );
  return new;
end;
$$ language plpgsql security definer;

-- 2. Recolore quem já existe (rode o select abaixo primeiro se quiser conferir os ids)
-- select id, name, color from public.profiles;
update public.profiles set color = '#29F1D6' where id = 'ad3c0734-82ae-421d-abe1-b0be7f917567'; -- Rodrigo
update public.profiles set color = '#8B5CF6' where id = '5d5db413-e2ec-4d22-8c83-06876bdc6e29'; -- Romulo
update public.profiles set color = '#FFC145' where id = 'ef69c591-5510-4e43-be85-bf496d64cb0e'; -- Efrem

-- 3. Tabela de assinaturas de notificação push (uma por dispositivo/navegador)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "user manages own push subscriptions" on public.push_subscriptions;
create policy "user manages own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
