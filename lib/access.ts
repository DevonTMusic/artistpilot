import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
// Use at the top of any members-only page. Sends visitors to login, or to the paywall if unpaid.
export async function requirePaid() {
  const session = await getCurrentSession();
  const user = session?.user;
  if (!user) redirect("/login");
  const { rows: [profile] } = await query<{ is_paid: boolean; default_bpm: number }>(
    "select is_paid, default_bpm from profiles where id = $1",
    [user.id],
  );
  if (!profile?.is_paid) redirect("/dashboard");
  return { user, profile };
}

// Use on pages that free users may open. Returns whether the user has Pro instead of redirecting.
export async function requireUser() {
  const session = await getCurrentSession();
  const user = session?.user;
  if (!user) redirect("/login");
  const { rows: [profile] } = await query<{ is_paid: boolean; default_bpm: number }>(
    "select is_paid, default_bpm from profiles where id = $1",
    [user.id],
  );
  return { user, profile, isPro: !!profile?.is_paid };
}
