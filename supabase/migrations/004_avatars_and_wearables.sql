-- Migração: foto de perfil, pôster de IA da jornada, e sincronização com apps externos (Strava/Garmin/Samsung)
-- Rode isso no SQL Editor do Supabase depois das migrações anteriores.

-- 1. Buckets de armazenamento (público pra leitura, já que avatar e pôster aparecem no app pra todo mundo)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do nothing;

-- Qualquer pessoa (mesmo sem login) pode VER os arquivos, pra imagem carregar no app e em links compartilhados
drop policy if exists "avatar images are publicly accessible" on storage.objects;
create policy "avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "poster images are publicly accessible" on storage.objects;
create policy "poster images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'posters');

-- Cada usuário só pode subir/trocar/apagar a PRÓPRIA foto de perfil.
-- O app salva sempre em "{user_id}/avatar.jpg" — a política confere se a primeira pasta do caminho é o próprio uid.
drop policy if exists "users can upload own avatar" on storage.objects;
create policy "users can upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can update own avatar" on storage.objects;
create policy "users can update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete own avatar" on storage.objects;
create policy "users can delete own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Pôsteres são gerados e salvos pela rota de API (service role), não direto pelo navegador —
-- por isso não existe policy de insert pra "authenticated" no bucket "posters".

-- 2. Rastreio de origem de cada corrida (manual x importada de um app externo) + evita duplicar corrida ao sincronizar
alter table public.runs
  add column if not exists source text not null default 'manual',
  add column if not exists external_id text;

create unique index if not exists runs_external_unique
  on public.runs (journey_id, source, external_id)
  where external_id is not null;

-- 3. Conexões com apps externos (Strava, Garmin, Samsung Health)
-- Os tokens ficam aqui mas SEM policy de select/insert/update pra "authenticated":
-- só a rota de API (que usa a service role) consegue ler/gravar isso. O navegador nunca
-- acessa essa tabela direto — só através de /api/wearables/*, que devolve status sem o token.
create table if not exists public.wearable_connections (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('strava', 'garmin', 'samsung')),
  provider_user_id text,
  access_token text not null,
  refresh_token text,
  expires_at bigint,
  scope text,
  default_journey_id uuid references public.journeys(id) on delete set null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.wearable_connections enable row level security;
-- Nenhuma policy criada de propósito — bloqueia tudo pra "authenticated" e "anon".
-- Só a service role (usada nas rotas server-side) passa por cima do RLS.
