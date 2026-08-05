-- Prompt & Pace — schema inicial
-- Rode isso no SQL Editor do seu projeto Supabase (Database > SQL Editor > New query)

create extension if not exists "uuid-ossp";

-- 1. Perfis (um por usuário autenticado)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  color text not null default '#29F1D6',
  created_at timestamptz not null default now()
);

-- 2. Jornadas (temporadas/desafios)
create table if not exists public.journeys (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  season text not null,
  goal_km numeric not null,
  theme_a text not null default '#29F1D6',
  theme_b text not null default '#8B5CF6',
  starts_on date not null default current_date,
  ends_on date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 3. Membros de cada jornada
create table if not exists public.journey_members (
  journey_id uuid references public.journeys(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (journey_id, user_id)
);

-- 4. Corridas registradas
create table if not exists public.runs (
  id uuid primary key default uuid_generate_v4(),
  journey_id uuid not null references public.journeys(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  km numeric not null check (km > 0),
  time_sec integer not null check (time_sec > 0),
  bpm integer,
  created_at timestamptz not null default now()
);

-- 5. Trigger: cria o profile automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    '#29F1D6'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. Row Level Security
alter table public.profiles enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_members enable row level security;
alter table public.runs enable row level security;

-- Perfis: qualquer pessoa logada pode ver todos os perfis (precisa pra mostrar nome/avatar dos outros no ranking)
create policy "profiles are viewable by authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Jornadas: visível apenas para quem é membro
create policy "journeys viewable by members"
  on public.journeys for select
  using (
    exists (
      select 1 from public.journey_members
      where journey_members.journey_id = journeys.id
      and journey_members.user_id = auth.uid()
    )
  );

create policy "authenticated users can create journeys"
  on public.journeys for insert
  with check (auth.uid() = created_by);

-- Membros: visível para outros membros da mesma jornada
create policy "journey_members viewable by same journey members"
  on public.journey_members for select
  using (
    exists (
      select 1 from public.journey_members jm
      where jm.journey_id = journey_members.journey_id
      and jm.user_id = auth.uid()
    )
  );

create policy "users can join a journey"
  on public.journey_members for insert
  with check (auth.uid() = user_id);

-- Corridas: visível para membros da jornada; só o dono pode inserir/editar a própria
create policy "runs viewable by journey members"
  on public.runs for select
  using (
    exists (
      select 1 from public.journey_members
      where journey_members.journey_id = runs.journey_id
      and journey_members.user_id = auth.uid()
    )
  );

create policy "users can insert own runs"
  on public.runs for insert
  with check (auth.uid() = user_id);

create policy "users can update own runs"
  on public.runs for update
  using (auth.uid() = user_id);

create policy "users can delete own runs"
  on public.runs for delete
  using (auth.uid() = user_id);
