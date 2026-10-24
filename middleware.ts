import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(req: NextRequest) {
  if (!getSessionCookie(req)) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/home/:path*", "/dashboard/:path*", "/settings/:path*", "/academy/:path*", "/studio/:path*"] };
