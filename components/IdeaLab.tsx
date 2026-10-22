"use client";
import { useState } from "react";
export default function IdeaLab() {
  const [instrument, setInstrument] = useState("Guitar");
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState(""); const [busy, setBusy] = useState(false);
  async function ask(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setAnswer("");
    const r = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instrument, message }) });
    const j = await r.json();
    setAnswer(r.ok ? j.text : j.error || "Something went wrong. Try again.");
    setBusy(false);
  }
  const field = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5";
  return (
    <div className="max-w-2xl">
      <form onSubmit={ask} className="space-y-4">
        <label className="block text-sm font-bold">Instrument
          <select className={field + " mt-1 font-normal"} value={instrument} onChange={(e) => setInstrument(e.target.value)}>
            {["Guitar", "Piano", "Bass", "Drums"].map((i) => <option key={i}>{i}</option>)}
          </select></label>
        <label className="block text-sm font-bold">What are you working on?
          <textarea className={field + " mt-1 font-normal"} rows={4} maxLength={1000} required value={message} onChange={(e) => setMessage(e.target.value)} placeholder="I have a four-chord idea in A minor and want to make the verse feel different from the chorus." /></label>
        <button disabled={busy} className="rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-3 font-bold disabled:opacity-60">{busy ? "Thinking..." : "Ask the coach"}</button>
      </form>
      {answer && <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-900 p-5 leading-relaxed" aria-live="polite">{answer}</div>}
    </div>
  );
}
