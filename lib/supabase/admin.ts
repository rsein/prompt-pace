import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client server-only, com a service role key — ignora RLS.
// Usado só nas rotas de API que precisam agir "pelo sistema" (ex: mandar notificação
// pra OUTROS usuários, o que o client normal não pode fazer por causa do RLS).
// Nunca importe isso em código que roda no navegador.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
