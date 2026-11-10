"use client";
import { useState } from "react";
import { AICreditPacks, type CoachUsage } from "@/components/AICreditPacks";

const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts", "YouTube", "Twitter / X"];

export default function PromoTools() {
  const [mode, setMode] = useState<"bio" | "content" | "caption" | "release">("bio");
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [story, setStory] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<CoachUsage | null>(null);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setAnswer("");
    setError("");
    const message = [
      `Artist name: ${name}`,
      `Genre/sound: ${genre}`,
      mode === "content" || mode === "caption" ? `Platform: ${platform}` : "",
      mode === "release" && releaseDate ? `Release date: ${releaseDate}` : "",
      `About the artist: ${story}`,
    ].filter(Boolean).join("\n").slice(0, 1000);
    try {
      const res = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, message, instrument: "general" }) });
      const json = await res.json() as { text?: string; error?: string; usage?: CoachUsage };
      if (json.usage) setUsage(json.usage);
      if (!res.ok) setError(json.error || "Something went wrong.");
      else setAnswer(json.text ?? "");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-[#51456F] bg-[#171328] px-3 py-2.5 font-normal";
  const tab = (active: boolean) => `rounded-lg px-4 py-2 text-sm font-bold ${active ? "bg-[#B89CFF] text-[#19152B]" : "border border-[#51456F] text-zinc-300 hover:border-[#B89CFF]"}`;
  return (
    <section className="mt-12 max-w-2xl">
      <h2 className="text-2xl font-extrabold">Bios, captions & release plans</h2>
      <p className="mb-4 mt-1 text-zinc-300">Pro tools to help you promote your music. They use your included AI requests.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={tab(mode === "bio")} onClick={() => { setMode("bio"); setAnswer(""); }}>Artist bio</button>
        <button type="button" className={tab(mode === "content")} onClick={() => { setMode("content"); setAnswer(""); }}>Content ideas</button>
        <button type="button" className={tab(mode === "caption")} onClick={() => { setMode("caption"); setAnswer(""); }}>Captions</button>
        <button type="button" className={tab(mode === "release")} onClick={() => { setMode("release"); setAnswer(""); }}>Release plan</button>
      </div>
      <form onSubmit={generate} className="space-y-4">
        <label className="block text-sm font-bold">Artist name
          <input className={field + " mt-1"} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block text-sm font-bold">Genre or sound
          <input className={field + " mt-1"} required maxLength={80} value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="e.g. dreamy indie pop with 808s" /></label>
        {(mode === "content" || mode === "caption") && (
          <label className="block text-sm font-bold">Platform
            <select className={field + " mt-1"} value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((item) => <option key={item}>{item}</option>)}
            </select></label>
        )}
        {mode === "release" && (
          <label className="block text-sm font-bold">Release date
            <input type="date" className={field + " mt-1"} value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} /></label>
        )}
        <label className="block text-sm font-bold">{mode === "bio" ? "Your story, influences, achievements" : mode === "caption" ? "What is the post about?" : mode === "release" ? "What are you releasing (single, EP) and your goals?" : "Your vibe, audience, what you're releasing"}
          <textarea className={field + " mt-1"} rows={4} required maxLength={600} value={story} onChange={(e) => setStory(e.target.value)} /></label>
        <button disabled={busy} className="rounded-lg bg-[#B89CFF] px-5 py-3 font-bold text-[#19152B] hover:bg-[#D0BCFF] disabled:opacity-60">{busy ? "Writing..." : mode === "bio" ? "Write my bio" : mode === "caption" ? "Write captions" : mode === "release" ? "Build my release plan" : "Get content ideas"}</button>
      </form>
      <AICreditPacks usage={usage} />
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</p>}
      {answer && (
        <div className="mt-6 rounded-2xl border border-[#3B3155] bg-[#241D3A] p-5">
          <div className="whitespace-pre-wrap leading-relaxed" aria-live="polite">{answer}</div>
          <button type="button" onClick={() => { void navigator.clipboard.writeText(answer); setCopied(true); }} className="mt-4 rounded-lg border border-[#51456F] px-3 py-1.5 text-sm font-bold hover:border-[#B89CFF]">{copied ? "Copied" : "Copy"}</button>
        </div>
      )}
    </section>
  );
}
