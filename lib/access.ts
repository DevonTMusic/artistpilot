import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
// Use at the top of any members-only page. Sends visitors to login, or to the paywall if unpaid.
export async function requirePaid() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  if (!profile?.is_paid) redirect("/dashboard");
  return { sb, user, profile };
}
