# Copilot instructions for Prompt & Pace

- This repo is a Next.js 14 App Router app for a running group challenge. The main user flow is: `/login` -> `/home` -> `/journey/[id]`.
- Route pages under `app/` are usually server components that fetch data directly from Supabase. Keep auth/data access there unless the feature truly needs browser-only state.
- The shared Supabase clients live in `lib/supabase/server.ts` and `lib/supabase/client.ts`. Use the server client in server components, the browser client in client components.
- Auth and redirects are handled by `middleware.ts`; protected pages redirect unauthenticated users to `/login` and authenticated users away from `/login`.
- The app’s core tables are `profiles`, `journeys`, `journey_members`, and `runs` from `supabase/schema.sql`. Preserve those names and the existing RLS assumptions when adding features.
- Journey creation is still manual through Supabase SQL; do not introduce a new journey-creation UI unless the task explicitly asks for it.
- The journey detail screen is assembled in `app/journey/[id]/page.tsx` and `components/JourneyClient.tsx`. Data flows from the page into the client component via props, then local state is updated after run inserts.
- New run registration follows the pattern in `components/RegisterRunModal.tsx`: insert into `runs`, then call `onRegistered()` and `onClose()`.
- The AI narrator lives in `app/api/narrator/route.ts`. Keep it server-side and read `ANTHROPIC_API_KEY` from environment variables; never expose the key to the browser.
- When changing the narrator prompt, keep the output short, humorous, and in Brazilian Portuguese; the current route expects a single message string.
- Styling is Tailwind-based with a dark “run club” visual language. Preserve the existing gradients and the per-journey `theme_a` / `theme_b` colors from the database.
- Keep UI copy in Brazilian Portuguese to match the current app, e.g. “Registrar corrida”, “Jornada”, “Perfil”, “Bem-vindo de volta”.
- Shared UI helpers live in `lib/utils.ts` (`initials`, `fmtPace`, `fmtTime`, `parseTimeInput`). Reuse them instead of creating ad-hoc formatting helpers.
- Type definitions are centralized in `lib/types.ts`; prefer these types over inline object shapes when touching Supabase data.
- There is no test suite configured yet. The standard workflow is `npm install`, `npm run dev`, and `npm run build`.
- If you add environment variables, document them in the README and use the same names the app already expects: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ANTHROPIC_API_KEY`.
