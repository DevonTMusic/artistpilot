import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { lessonById } from "@/lib/lessons";
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { lessonId } = await req.json();
  if (typeof lessonId !== "string" || !lessonById(lessonId)) return NextResponse.json({ error: "Unknown lesson." }, { status: 400 });
  const { error } = await sb.from("lesson_progress").upsert({ user_id: user.id, lesson_id: lessonId }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Could not save progress." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
