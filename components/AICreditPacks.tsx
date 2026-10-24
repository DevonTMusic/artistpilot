"use client";
import { useEffect, useState } from "react";

export interface CoachUsage {
  freeUsed: number;
  freeLimit: number;
  creditsRemaining: number;
  globalLimitReached?: boolean;
}

export function AICreditPacks({ usage }: { usage: CoachUsage | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [displayUsage, setDisplayUsage] = useState(usage);

  useEffect(() => {
    setDisplayUsage(usage);
  }, [usage]);

  useEffect(() => {
    let active = true;
    fetch("/api/ai-credits", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { usage?: CoachUsage; error?: string };
        if (!response.ok || !result.usage) throw new Error(result.error ?? "Could not load AI credit balance.");
        if (active) {
          setDisplayUsage(result.usage);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load AI credit balance.");
      });
    return () => { active = false; };
  }, []);

  async function buy(pack: "100" | "250") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Could not start checkout.");
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start checkout.");
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3" aria-label="AI coach usage and credits">
      <p className="text-xs font-semibold text-zinc-200">
          {displayUsage
            ? `${displayUsage.freeUsed}/${displayUsage.freeLimit} included requests used · ${displayUsage.creditsRemaining} prepaid credits`
          : "50 AI coach requests included each month · 1 credit = 1 extra request"}
      </p>
        {displayUsage?.globalLimitReached ? (
        <p className="mt-2 text-xs text-amber-300">The shared monthly AI safety limit has been reached. More requests and credit purchases are paused until next month.</p>
      ) : (
        <>
          <p className="mt-2 text-[11px] text-zinc-500">Need more? Choose a one-time prepaid pack. Credits are added after Stripe confirms payment.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void buy("100")} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 hover:border-violet-500 disabled:opacity-50">
              {busy ? "Opening checkout..." : "100 credits · $5"}
            </button>
            <button type="button" disabled={busy} onClick={() => void buy("250")} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 hover:border-violet-500 disabled:opacity-50">
              {busy ? "Opening checkout..." : "250 credits · $10"}
            </button>
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
