# Prompt & Pace

App do grupo de corrida — metas mensais e/ou anuais de km, ranking, narrador com IA.

## O que já funciona

- Login / criar conta (email + senha, via Supabase Auth)
- Home: suas jornadas ordenadas pela mais ativa recentemente, botão de criar jornada, botão de registrar corrida
- Criar jornada com nome e período (mensal, anual, ou os dois)
- Editar e excluir jornada (menu de 3 pontinhos, com confirmação antes de excluir)
- Tela da Jornada: pódio, ranking mensal e/ou anual (com seletor quando os dois estão ativos), histórico, barra de progresso
- Registrar corrida (km, tempo, batimentos, calorias) — manual ou tirando/enviando uma foto do relógio/app (a IA lê os dados e você confere antes de salvar)
- Aba Perfil com suas estatísticas pessoais
- Narrador com IA real (chama a API do Claude a cada corrida registrada, considerando o período selecionado)

## O que ainda não está aqui (próximos passos)

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

No painel do seu projeto: `SQL Editor > New query`.

1. Cole o conteúdo de `supabase/schema.sql` e rode — cria as tabelas base, RLS e o gatilho de perfil.
2. Depois, cole e rode cada arquivo dentro de `supabase/migrations/`, em ordem numérica — cada um ajusta o banco pra uma leva de features nova.

## 3. Instalar e rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## 4. Criar a primeira jornada

Já dá pra fazer direto pelo app: entra, clica no `+` no canto da Home, preenche nome/período/meta. Isso já te adiciona como membro automaticamente. Os outros membros do grupo entram pela mesma jornada quando você os adiciona — hoje isso ainda é feito via SQL Editor:

```sql
-- pega o id de cada pessoa (ela precisa ter criado conta antes)
select id, name from public.profiles;

-- adiciona como membro da jornada (repete pra cada pessoa)
insert into public.journey_members (journey_id, user_id)
values ('ID-DA-JORNADA', 'ID-DA-PESSOA');
```

(O `ID-DA-JORNADA` você pega no painel do Supabase, tabela `journeys`, ou na URL da jornada dentro do app: `/journey/ID-DA-JORNADA`.)

## Estrutura

```
app/
  login/page.tsx        — tela de login/cadastro
  home/page.tsx          — busca as jornadas e estatísticas, delega a tela pro HomeClient
  journey/[id]/page.tsx  — busca os dados e monta a tela da jornada
  api/narrator/route.ts  — chama a API do Claude (server-side, chave nunca exposta ao navegador)
components/
  HomeClient.tsx          — Home interativa: criar jornada, registrar corrida, reordenação
  JourneyFormModal.tsx    — formulário de criar/editar jornada (nome, período, metas)
  JourneyCardMenu.tsx     — menu de 3 pontinhos (editar/excluir) com confirmação
  JourneyClient.tsx       — tela da jornada (pódio, ranking mensal/anual, histórico, perfil, narrador)
  RegisterRunModal.tsx    — formulário de registrar corrida
  Avatar.tsx, Podium.tsx
lib/
  supabase/client.ts      — client do Supabase pro navegador
  supabase/server.ts      — client do Supabase pro servidor (Server Components)
  types.ts, utils.ts
supabase/
  schema.sql               — tabelas, RLS e trigger inicial
  migrations/               — mudanças de schema por leva de feature, em ordem
middleware.ts               — protege as rotas: sem login, redireciona pra /login
```
