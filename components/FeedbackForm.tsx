"use client";
import { useState } from "react";

export default function FeedbackForm() {
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, message }) });
    if (res.ok) {
      setMessage("");
      setStatus("sent");
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 rounded-2xl border border-[#3B3155] bg-[#241D3A] p-5">
      <h2 className="text-xl font-bold">Send feedback</h2>
      <p className="mt-1 text-zinc-400">Tell us what to fix or add. Only the ArtistPilot owner can read this.</p>
      <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Feedback type" className="mt-3 rounded-lg border border-[#3B3155] bg-[#19152B] px-3 py-2 text-sm">
        <option value="general">General</option>
        <option value="bug">Bug</option>
        <option value="idea">Feature idea</option>
        <option value="studio">Studio</option>
        <option value="academy">Academy</option>
      </select>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} required minLength={3} maxLength={2000} rows={4} aria-label="Your feedback" placeholder="What's working, what's not, what do you wish it did?" className="mt-3 w-full rounded-lg border border-[#3B3155] bg-[#19152B] p-3 text-sm" />
      <div className="mt-3 flex items-center gap-3">
        <button disabled={status === "sending"} className="rounded-lg bg-[#B89CFF] px-4 py-2 font-bold text-[#19152B] hover:bg-[#D0BCFF] disabled:opacity-60">{status === "sending" ? "Sending..." : "Submit"}</button>
        {status === "sent" && <span role="status" className="text-sm text-emerald-300">Thanks! Your feedback was sent.</span>}
        {status === "error" && <span role="alert" className="text-sm text-red-300">{error}</span>}
      </div>
    </form>
  );
}
