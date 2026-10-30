"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export interface CoachUsage {
  freeUsed: number;
  freeLimit: number;
  creditsRemaining: number;
  globalLimitReached?: boolean;
}

export function AICreditPacks({ usage }: { usage: CoachUsage | null }) {
  const { t } = useLanguage();
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
        if (!response.ok || !result.usage) throw new Error(result.error ?? t("credits.loadError"));
        if (active) {
          setDisplayUsage(result.usage);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : t("credits.loadError"));
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
      if (!response.ok || !result.url) throw new Error(result.error ?? t("credits.checkoutError"));
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("credits.checkoutError"));
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-[#3B3155] bg-[#171328]/60 p-3" aria-label={t("credits.aria")}>
      <p className="text-xs font-semibold text-zinc-200">
          {displayUsage
            ? t("credits.usage", { used: displayUsage.freeUsed, limit: displayUsage.freeLimit, credits: displayUsage.creditsRemaining })
            : t("credits.included")}
      </p>
        {displayUsage?.globalLimitReached ? (
          <p className="mt-2 text-xs text-[#b9f6d0]">{t("credits.globalLimit")}</p>
      ) : (
        <>
            <p className="mt-2 text-[11px] text-zinc-400">{t("credits.needMore")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void buy("100")} className="rounded-lg border border-[#51456F] bg-[#241D3A] px-3 py-2 text-xs font-semibold text-zinc-100 hover:border-[#B89CFF] disabled:opacity-50">
                {busy ? t("credits.opening") : t("credits.pack100")}
            </button>
            <button type="button" disabled={busy} onClick={() => void buy("250")} className="rounded-lg border border-[#51456F] bg-[#241D3A] px-3 py-2 text-xs font-semibold text-zinc-100 hover:border-[#B89CFF] disabled:opacity-50">
                {busy ? t("credits.opening") : t("credits.pack250")}
            </button>
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
