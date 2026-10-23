import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      // @ts-ignore
      setAll: (list: any) => {
        list.forEach((c: any) => req.cookies.set(c.name, c.value));
        res = NextResponse.next({ request: req });
        list.forEach((c: any) => res.cookies.set(c.name, c.value, c.options));
      },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  return res;
}
export const config = { matcher: ["/home/:path*", "/dashboard/:path*", "/settings/:path*", "/academy/:path*", "/studio/:path*"] };
