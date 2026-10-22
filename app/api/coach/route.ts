import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
const SYSTEM = `You are ArtistPilot's music coach. Help the musician develop THEIR OWN idea.
Never write a finished song, full lyrics, or a complete arrangement. Instead: ask 1-2 clarifying questions, explain relevant theory in plain language, offer 2-3 concrete options to try (chord substitutions, rhythm ideas, bassline approaches, groove variations), and give one small exercise. Keep answers under 250 words.`;
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { data: p } = await sb.from("profiles").select("is_paid").eq("id", user.id).single();
  if (!p?.is_paid) return NextResponse.json({ error: "ArtistPilot Pro is required." }, { status: 402 });
  const { instrument, message } = await req.json();
  if (typeof message !== "string" || !message.trim() || message.length > 1000) return NextResponse.json({ error: "Write a message under 1000 characters." }, { status: 400 });
  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: `Instrument: ${String(instrument).slice(0, 20)}\n${message}` }] }],
        generationConfig: { maxOutputTokens: 700 },
      }),
    });
    if (!r.ok) throw new Error(r.status + " " + (await r.text()));
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? "").join("");
    if (!text) throw new Error("empty");
    return NextResponse.json({ text });
  } catch (e) { console.error("coach error:", e);
    return NextResponse.json({ error: "The coach is unavailable right now. Try again in a minute." }, { status: 502 });
  }
}
