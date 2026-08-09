-- Migração: adiciona o campo de gênero no perfil (opcional) — usado pra IA nunca trocar
-- o gênero de ninguém ao gerar o pôster de ranking.
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

alter table public.profiles
  add column if not exists gender text check (gender in ('masculino', 'feminino', 'prefiro_nao_dizer'));

-- Atualiza o trigger de criação de perfil pra já salvar o gênero informado no cadastro
create or replace function public.handle_new_user()
returns trigger as $$
declare
  palette text[] := array['#29F1D6', '#8B5CF6', '#FFC145', '#FF6B9D', '#5CFF8F', '#FF7A5C'];
  existing_count int;
begin
  select count(*) into existing_count from public.profiles;

  insert into public.profiles (id, name, color, gender)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    palette[(existing_count % array_length(palette, 1)) + 1],
    new.raw_user_meta_data->>'gender'
  );
  return new;
end;
$$ language plpgsql security definer;
