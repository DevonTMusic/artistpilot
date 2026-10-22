import { createClient } from "@supabase/supabase-js";
// Server-only. Bypasses row-level security. Never import in client components.
export const supabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
