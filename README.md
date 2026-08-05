# Prompt & Pace

App do grupo de corrida — meta mensal de km, ranking, narrador com IA.

## O que já funciona

- Login / criar conta (email + senha, via Supabase Auth)
- Home com suas jornadas e progresso
- Tela da Jornada: pódio, histórico, barra de progresso
- Registrar corrida (km, tempo, batimentos) — grava direto no Supabase
- Aba Perfil com suas estatísticas pessoais
- Narrador com IA real (chama a API do Claude a cada corrida registrada)

## O que ainda não está aqui (próximos passos)

- Tela de criar jornada pelo app (por enquanto, cria via SQL — veja abaixo)
- Upload de foto de perfil (a coluna `avatar_url` já existe no banco, falta a tela de upload)
- Geração de imagem/pôster da jornada
- Notificação pros outros membros quando alguém registra
- Sincronização com Strava / Garmin

## 1. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preencha com os valores do seu projeto Supabase (`Project Settings > API`) e sua chave da Anthropic (`console.anthropic.com > API Keys`).

## 2. Criar as tabelas no Supabase

No painel do seu projeto: `SQL Editor > New query`, cole o conteúdo de `supabase/schema.sql` e rode.

Isso cria as tabelas (`profiles`, `journeys`, `journey_members`, `runs`), as políticas de segurança (RLS) e um gatilho que cria automaticamente o perfil de cada pessoa que se cadastra.

## 3. Instalar e rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## 4. Criar a primeira jornada e adicionar os membros

Ainda não tem tela pra isso no app — faça pelo SQL Editor do Supabase:

1. Cada pessoa do grupo cria a própria conta em `/login` (aba "Criar conta"). Isso já cria o `profile` automaticamente.
2. No SQL Editor, veja os IDs criados:
   ```sql
   select id, name from public.profiles;
   ```
3. Crie a jornada:
   ```sql
   insert into public.journeys (title, season, goal_km, ends_on, created_by)
   values ('Prompt & Pace', 'Temporada de agosto', 200, '2026-08-31', 'SEU-ID-AQUI')
   returning id;
   ```
4. Adicione cada pessoa como membro (repita para cada uma, usando o `id` da jornada retornado acima):
   ```sql
   insert into public.journey_members (journey_id, user_id)
   values ('ID-DA-JORNADA', 'ID-DA-PESSOA');
   ```

Depois disso a jornada já aparece na Home de todos os membros.

## Estrutura

```
app/
  login/page.tsx        — tela de login/cadastro
  home/page.tsx          — lista de jornadas
  journey/[id]/page.tsx  — busca os dados e monta a tela da jornada
  api/narrator/route.ts  — chama a API do Claude (server-side, chave nunca exposta ao navegador)
components/
  JourneyClient.tsx       — tela da jornada (pódio, histórico, perfil, narrador)
  RegisterRunModal.tsx    — formulário de registrar corrida
  Avatar.tsx, Podium.tsx
lib/
  supabase/client.ts      — client do Supabase pro navegador
  supabase/server.ts      — client do Supabase pro servidor (Server Components)
  types.ts, utils.ts
supabase/schema.sql        — tabelas, RLS e trigger
middleware.ts               — protege as rotas: sem login, redireciona pra /login
```
