"use client";
import { useState } from "react";
import { AICreditPacks, type CoachUsage } from "@/components/AICreditPacks";
import { ChordVisualizer, normalizeChordName } from "@/components/ChordVisualizer";
import { useLanguage } from "@/components/LanguageProvider";

function findChord(text: string): string | null {
  const explicitQuality = text.match(/\b([A-G](?:#|b|♯|♭)?(?:maj7|m7|maj|major|min|minor|dim|aug|sus2|sus4|7|m))\b/);
  if (explicitQuality) return normalizeChordName(explicitQuality[1]);
  const phrase = text.match(/\b(?:chord|play|playing|try|use|for)\s+(?:an?\s+)?([A-G](?:#|b|♯|♭)?)(?:\s+(major|minor))?\b/i);
  if (phrase) return normalizeChordName(`${phrase[1]}${phrase[2] === "minor" ? "m" : ""}`);
  return null;
}

export default function IdeaLab() {
  const { locale, t } = useLanguage();
  const [instrument, setInstrument] = useState("Guitar");
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [visualChord, setVisualChord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<CoachUsage | null>(null);
  async function ask(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setAnswer("");
    setError("");
    try {
      const r = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instrument, message }) });
      const j = await r.json() as { text?: string; error?: string; usage?: CoachUsage };
      if (j.usage) setUsage(j.usage);
      if (!r.ok) {
        setError(j.error || t("ideas.error"));
        return;
      }
      setAnswer(j.text ?? t("ideas.emptyAnswer"));
      setVisualChord(findChord(message) ?? findChord(j.text ?? "") ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("ideas.connectionError"));
    } finally {
      setBusy(false);
    }
  }
  const field = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5";
  return (
    <div className="max-w-2xl">
      <form onSubmit={ask} className="space-y-4">
        <label className="block text-sm font-bold">{t("ideas.instrument")}
          <select className={field + " mt-1 font-normal"} value={instrument} onChange={(e) => setInstrument(e.target.value)}>
            {["Guitar", "Piano", "Bass", "Ukulele", "Violin", "Vocals", "Drums"].map((i) => (
              <option key={i} value={i}>{locale === "es" ? ({
                Guitar: "Guitarra", Piano: "Piano", Bass: "Bajo", Ukulele: "Ukelele",
                Violin: "Violín", Vocals: "Voz", Drums: "Batería",
              } as Record<string, string>)[i] : i}</option>
            ))}
          </select></label>
        <label className="block text-sm font-bold">{t("ideas.prompt")}
          <textarea className={field + " mt-1 font-normal"} rows={4} maxLength={1000} required value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("ideas.placeholder")} /></label>
        <button disabled={busy} className="rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-3 font-bold disabled:opacity-60">{busy ? t("ideas.thinking") : t("ideas.ask")}</button>
      </form>
      <AICreditPacks usage={usage} />
      {error && <p className="mt-4 rounded-lg border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-300" role="alert">{error}</p>}
      {answer && (
        <>
          <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-900 p-5 leading-relaxed" aria-live="polite">{answer}</div>
          <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block text-sm font-bold">{t("ideas.visualChord")}
                <input
                  className={field + " mt-1 font-normal"}
                  value={visualChord}
                  onChange={(event) => setVisualChord(event.target.value)}
                  maxLength={12}
                  placeholder={t("ideas.chordPlaceholder")}
                />
              </label>
              <p className="text-[11px] leading-relaxed text-zinc-400">{t("ideas.editChord")}</p>
            </div>
            <ChordVisualizer instrument={instrument} chord={visualChord} />
          </div>
        </>
      )}
    </div>
  );
}
