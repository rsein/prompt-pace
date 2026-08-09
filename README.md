# Prompt & Pace

App do grupo de corrida — metas mensais e/ou anuais de km, ranking, narrador com IA.

## O que já funciona

- Login / criar conta (email + senha, via Supabase Auth)
- Home: suas jornadas ordenadas pela mais ativa recentemente, botão de criar jornada, botão de registrar corrida
- Criar jornada com nome e período (mensal, anual, ou os dois)
- Editar e excluir jornada (menu de 3 pontinhos, com confirmação antes de excluir)
- Tela da Jornada: pódio, ranking mensal e/ou anual (com seletor quando os dois estão ativos), histórico, barra de progresso
- Registrar corrida (km, tempo, pace calculado, batimentos, calorias) — manual ou tirando/enviando (câmera ou galeria) uma foto do relógio/app, que a IA lê e você confere antes de salvar
- Cor diferente por participante
- Aba Perfil com suas estatísticas pessoais
- Narrador com IA real, engraçado e atualizado a cada corrida registrada (considerando o período selecionado)
- Notificação push pro celular dos outros membros com o comentário do narrador, sempre que alguém registra uma corrida

- Foto de perfil (upload direto na aba Perfil, salva no Supabase Storage)
- Pôster de IA do ranking: gera uma ilustração cômica do 1º/2º/3º lugar (usando a foto de cada um como referência quando disponível), com botão de compartilhar direto pro WhatsApp/Instagram/etc via Web Share API
- Sincronização automática de corridas com o **Strava** (conectar, sincronizar, desconectar — tudo pela aba Perfil)

## O que ainda não está aqui (próximos passos)

- Sincronização com **Garmin Connect** e **Samsung Health** — a estrutura de banco e a tela já existem (aparecem como "Em breve" na aba Perfil), mas faltam as credenciais dos provedores. Ver seção "Sincronização com apps externos" abaixo pro motivo.
- Geração de imagem/pôster de jornada como um todo (hoje é focado no ranking top 3)

## 1. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
npm install
```

Preencha com os valores do seu projeto Supabase (`Project Settings > API`, incluindo a `service_role`) e sua chave da OpenAI (`platform.openai.com > API Keys` — usada tanto pro narrador quanto pra leitura de foto). A chave da Anthropic no arquivo de exemplo não é mais usada por nenhuma rota; pode deixar em branco.

Pra notificações push, depois do `npm install`, gera as chaves rodando:

```bash
npx web-push generate-vapid-keys
```

Cola o `Public Key` em `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e o `Private Key` em `VAPID_PRIVATE_KEY`. Sem isso, o app funciona normal — só não envia notificação (a rota detecta que não está configurado e ignora silenciosamente).

⚠️ **No iPhone**, notificação push só funciona se o site for adicionado à Tela de Início (Safari → Compartilhar → Adicionar à Tela de Início) e aberto a partir daí — não funciona com o Safari aberto normal. No Android, funciona direto no Chrome.

### Foto de perfil e pôster de IA

Não precisam de nenhuma chave nova — usam o `OPENAI_API_KEY` que você já configurou (o pôster usa o modelo `gpt-image-1`, que exige uma conta OpenAI com **verificação de organização** feita em platform.openai.com/settings/organization/general; sem isso a chamada de geração de imagem retorna erro 403).

### Sincronizando com o Strava

1. Crie um app em [strava.com/settings/api](https://www.strava.com/settings/api). Em "Authorization Callback Domain", coloque só o domínio (sem `https://` e sem caminho) — em dev, `localhost`.
2. Copie o `Client ID` e o `Client Secret` pro `.env.local` (`STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`).
3. Preencha `NEXT_PUBLIC_APP_URL` com a URL onde o app roda (`http://localhost:3000` em dev).
4. Na aba Perfil de uma jornada, clique em "Conectar" no card do Strava. As corridas do tipo "Run" ficam disponíveis pra importar a partir daí (é feito um pedido manual de sincronização, sem importar o histórico inteiro de uma vez — só desde a última sincronização, ou os últimos 90 dias na primeira vez).

### Sincronização com Garmin e Samsung Health

Diferente do Strava, essas duas **não têm um cadastro de desenvolvedor self-service**:

- **Garmin Connect Developer Program**: só libera acesso via aprovação manual, é exclusivo pra uso empresarial (não aceita cadastro de pessoa física/projeto pessoal), e no momento está com **novos cadastros suspensos**, sem previsão de reabertura.
- **Samsung Health Platform API**: também exige aprovação prévia da Samsung como parceiro, com processo voltado pra empresas.

A tabela `wearable_connections` e a tela de Perfil já estão prontas pros dois — quando/se você conseguir acesso, é só reaproveitar o mesmo padrão das rotas `/api/strava/*` trocando os endpoints. Um atalho mais rápido, se topar depender de terceiro: agregadores como [Terra](https://tryterra.co) ou Spike já têm parceria com Garmin e Samsung Health e expõem uma API única — nesse caso a integração fica bem mais simples que negociar acesso direto com os dois fabricantes.

Enquanto isso, quem já sincroniza a Samsung Health com o Strava (recurso nativo do próprio app da Samsung) já vê essas corridas aparecerem aqui automaticamente ao conectar o Strava.

## 2. Criar as tabelas no Supabase

No painel do seu projeto: `SQL Editor > New query`.

1. Cole o conteúdo de `supabase/schema.sql` e rode — cria as tabelas base, RLS e o gatilho de perfil.
2. Depois, cole e rode cada arquivo dentro de `supabase/migrations/`, em ordem numérica — cada um ajusta o banco pra uma leva de features nova.

## 3. Rodar

```bash
npm run dev
```

Abra `http://localhost:3000`.

## 4. Criar a primeira jornada

Já dá pra fazer direto pelo app: entra, clica no `+` no canto da Home, preenche nome/período/meta. Isso já te adiciona como membro automaticamente. Pra adicionar os outros membros do grupo, busca pelo nome no campo "Participantes" do próprio formulário — a pessoa precisa já ter criado uma conta antes pra aparecer na busca. Se ela ainda não tem conta, é só adicionar depois, editando a jornada (menu de 3 pontinhos no card da jornada → editar).

## Estrutura

```
app/
  login/page.tsx           — tela de login/cadastro
  home/page.tsx             — busca as jornadas e estatísticas, delega a tela pro HomeClient
  journey/[id]/page.tsx     — busca os dados e monta a tela da jornada
  api/narrator/route.ts     — gera o comentário do narrador (chama a API do Claude)
  api/scan-run/route.ts     — lê a foto do relógio/app e extrai km/tempo/bpm/calorias (OpenAI, com visão)
  api/notify-run/route.ts   — manda a notificação push pros outros membros da jornada
  api/generate-poster/route.ts — gera o pôster de IA do ranking (OpenAI gpt-image-1) e salva no Storage
  api/strava/connect/route.ts    — inicia o OAuth do Strava
  api/strava/callback/route.ts   — troca o código pelo token e salva a conexão
  api/strava/sync/route.ts       — busca corridas novas no Strava e importa como runs
  api/strava/disconnect/route.ts — remove a conexão com o Strava
  api/wearables/status/route.ts  — status de conexão (Strava/Garmin/Samsung) sem expor tokens
components/
  HomeClient.tsx          — Home interativa: criar jornada, registrar corrida, reordenação
  JourneyFormModal.tsx    — formulário de criar/editar jornada (nome, período, metas)
  JourneyCardMenu.tsx     — menu de 3 pontinhos (editar/excluir) com confirmação
  JourneyClient.tsx       — tela da jornada (pódio, ranking mensal/anual, histórico, perfil, narrador, notificações)
  RegisterRunModal.tsx    — formulário de registrar corrida (manual ou por foto)
  ProfileAvatarUpload.tsx — upload de foto de perfil (aba Perfil)
  PosterModal.tsx          — modal de geração/compartilhamento do pôster de IA do ranking
  WearablesCard.tsx        — card de sincronização (Strava/Garmin/Samsung) na aba Perfil
  Avatar.tsx, Podium.tsx
lib/
  supabase/client.ts      — client do Supabase pro navegador
  supabase/server.ts      — client do Supabase pro servidor (Server Components)
  supabase/admin.ts       — client server-only com a service role key (ignora RLS, só em rotas de API)
  push.ts                 — funções do navegador pra assinar/cancelar notificações push
  strava.ts                — helpers de OAuth e refresh de token do Strava
  types.ts, utils.ts
public/
  sw.js                    — service worker que recebe e mostra a notificação push
supabase/
  schema.sql               — tabelas, RLS e trigger inicial
  migrations/               — mudanças de schema por leva de feature, em ordem
middleware.ts               — protege as rotas: sem login, redireciona pra /login
```
