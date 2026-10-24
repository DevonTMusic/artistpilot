import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const destination = next === "/home" ? next : "/home";
  const code = url.searchParams.get("code");

  if (!code || url.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("OAuth callback failed:", error.message);
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  return NextResponse.redirect(new URL(destination, url.origin));
}
