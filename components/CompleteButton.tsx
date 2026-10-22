"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function CompleteButton({ lessonId, done }: { lessonId: string; done: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  if (done) return <p className="font-bold text-emerald-400">Lesson completed</p>;
  async function go() {
    setBusy(true); setErr("");
    const r = await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId }) });
    if (r.ok) router.refresh(); else setErr("Could not save your progress. Try again.");
    setBusy(false);
  }
  return (<div>
    <button onClick={go} disabled={busy} className="rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-3 font-bold disabled:opacity-60">Mark lesson complete</button>
    {err && <p role="alert" className="mt-2 text-sm text-amber-300">{err}</p>}
  </div>);
}
