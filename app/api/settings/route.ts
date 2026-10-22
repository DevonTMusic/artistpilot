import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { INSTRUMENTS } from "@/lib/lessons";
// Only these fields can be changed from the browser. is_paid and stripe_customer_id never can.
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await req.json();
  const bpm = Number(b.default_bpm), goal = Number(b.weekly_goal);
  if (typeof b.display_name !== "string" || b.display_name.length > 40) return NextResponse.json({ error: "Display name must be 40 characters or fewer." }, { status: 400 });
  if (!INSTRUMENTS.includes(b.main_instrument)) return NextResponse.json({ error: "Pick one of the listed instruments." }, { status: 400 });
  if (!Number.isInteger(bpm) || bpm < 50 || bpm > 200) return NextResponse.json({ error: "Tempo must be between 50 and 200 BPM." }, { status: 400 });
  if (!Number.isInteger(goal) || goal < 1 || goal > 40) return NextResponse.json({ error: "Weekly goal must be between 1 and 40 hours." }, { status: 400 });
  const { error } = await supabaseAdmin().from("profiles").update({
    display_name: b.display_name.trim(), main_instrument: b.main_instrument, default_bpm: bpm, weekly_goal: goal,
    notify_reminders: !!b.notify_reminders, notify_news: !!b.notify_news,
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Could not save. Did you run settings.sql in Supabase?" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
