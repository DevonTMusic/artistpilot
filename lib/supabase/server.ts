import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      // @ts-ignore
      setAll: (list: any) => { try { list.forEach((cookie: any) => store.set(cookie.name, cookie.value, cookie.options)); } catch {} },
    },
  });
}
