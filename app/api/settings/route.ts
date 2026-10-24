import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { INSTRUMENTS } from "@/lib/lessons";
// Only these fields can be changed from the browser. is_paid and stripe_customer_id never can.
export async function POST(req: Request) {
  const { user } = (await getCurrentSession()) ?? {};
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await req.json();
  const bpm = Number(b.default_bpm), goal = Number(b.weekly_goal);
  if (typeof b.display_name !== "string" || b.display_name.length > 40) return NextResponse.json({ error: "Display name must be 40 characters or fewer." }, { status: 400 });
  if (!INSTRUMENTS.includes(b.main_instrument)) return NextResponse.json({ error: "Pick one of the listed instruments." }, { status: 400 });
  if (!Number.isInteger(bpm) || bpm < 50 || bpm > 200) return NextResponse.json({ error: "Tempo must be between 50 and 200 BPM." }, { status: 400 });
  if (!Number.isInteger(goal) || goal < 1 || goal > 40) return NextResponse.json({ error: "Weekly goal must be between 1 and 40 hours." }, { status: 400 });
  try {
    await query(
      `update profiles set display_name = $1, main_instrument = $2, default_bpm = $3,
       weekly_goal = $4, notify_reminders = $5, notify_news = $6 where id = $7`,
      [b.display_name.trim(), b.main_instrument, bpm, goal, !!b.notify_reminders, !!b.notify_news, user.id],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not save profile settings:", error);
    return NextResponse.json({ error: "Could not save your profile settings." }, { status: 500 });
  }
}
